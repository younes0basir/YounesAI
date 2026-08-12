const pool = require('../../db');
const { getGmailClient } = require('./client');
const { normalizeGmailMessage } = require('./parseMessage');
const { sanitizeEmailBody } = require('../../email/security/sanitize');
const { classifyEmail } = require('../../agents/email/pipeline');

async function upsertThread(client, account, normalized) {
  const result = await client.query(
    `INSERT INTO email_threads
       (user_id, account_id, gmail_thread_id, subject, snippet, last_message_at, message_count)
     VALUES ($1, $2, $3, $4, $5, $6, 1)
     ON CONFLICT (account_id, gmail_thread_id) DO UPDATE SET
       subject = COALESCE(EXCLUDED.subject, email_threads.subject),
       snippet = EXCLUDED.snippet,
       last_message_at = GREATEST(email_threads.last_message_at, EXCLUDED.last_message_at),
       message_count = email_threads.message_count + 1,
       updated_at = NOW()
     RETURNING id`,
    [
      account.user_id,
      account.id,
      normalized.gmailThreadId,
      normalized.subject,
      normalized.snippet,
      normalized.receivedAt.toISOString(),
    ]
  );
  return result.rows[0].id;
}

async function upsertEmail(client, account, threadId, normalized) {
  const bodyText = sanitizeEmailBody(normalized.bodyRaw || normalized.snippet);
  const result = await client.query(
    `INSERT INTO emails
       (user_id, account_id, thread_id, gmail_message_id, from_address, from_name,
        to_addresses, subject, snippet, body_text, received_at, is_read, is_starred, label_ids)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (account_id, gmail_message_id) DO UPDATE SET
       subject = EXCLUDED.subject,
       snippet = EXCLUDED.snippet,
       body_text = EXCLUDED.body_text,
       is_read = EXCLUDED.is_read,
       is_starred = EXCLUDED.is_starred,
       label_ids = EXCLUDED.label_ids,
       updated_at = NOW()
     RETURNING *`,
    [
      account.user_id,
      account.id,
      threadId,
      normalized.gmailMessageId,
      normalized.fromAddress,
      normalized.fromName,
      normalized.toAddresses,
      normalized.subject,
      normalized.snippet,
      bodyText,
      normalized.receivedAt.toISOString(),
      normalized.isRead,
      normalized.isStarred,
      normalized.labelIds,
    ]
  );
  return result.rows[0];
}

async function processMessage(gmail, account, messageId) {
  const { data: message } = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  const normalized = normalizeGmailMessage(message);

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    const threadId = await upsertThread(dbClient, account, normalized);
    const emailRow = await upsertEmail(dbClient, account, threadId, normalized);
    await dbClient.query('COMMIT');

    await classifyEmail(account.user_id, emailRow);
    return emailRow;
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
}

async function reclassifyPending(userId, accountId, limit = 25) {
  const result = await pool.query(
    `SELECT e.* FROM emails e
     LEFT JOIN email_classifications ec ON ec.email_id = e.id
     WHERE e.user_id = $1 AND e.account_id = $2
       AND (ec.category IS NULL OR ec.category = 'UNKNOWN')
     ORDER BY e.received_at DESC
     LIMIT $3`,
    [userId, accountId, limit]
  );
  for (const email of result.rows) {
    try {
      await classifyEmail(userId, email);
    } catch (err) {
      console.error(`[Gmail Sync] Reclassify failed ${email.id}:`, err.message);
    }
  }
  return result.rowCount;
}

async function syncAccount(accountId, userId) {
  const { gmail, account } = await getGmailClient(accountId, userId);

  await pool.query(
    `UPDATE email_accounts SET sync_status = 'syncing', last_sync_error = NULL, updated_at = NOW() WHERE id = $1`,
    [accountId]
  );

  let synced = 0;
  try {
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const currentHistoryId = profile.data.historyId;

    const syncState = await pool.query(
      'SELECT history_id FROM email_sync_state WHERE account_id = $1',
      [accountId]
    );
    const startHistoryId = syncState.rows[0]?.history_id || account.history_id;

    let messageIds = [];

    if (startHistoryId) {
      try {
        const historyRes = await gmail.users.history.list({
          userId: 'me',
          startHistoryId,
          historyTypes: ['messageAdded'],
        });
        const histories = historyRes.data.history || [];
        for (const h of histories) {
          for (const added of h.messagesAdded || []) {
            if (added.message?.id) messageIds.push(added.message.id);
          }
        }
      } catch (err) {
        if (err.code === 404 || err.message?.includes('historyId')) {
          messageIds = [];
        } else {
          throw err;
        }
      }
    }

    if (messageIds.length === 0) {
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 50,
        q: 'in:inbox OR in:updates OR in:promotions',
      });
      messageIds = (listRes.data.messages || []).map((m) => m.id);
    }

    const uniqueIds = [...new Set(messageIds)].slice(0, 100);
    for (const id of uniqueIds) {
      try {
        await processMessage(gmail, account, id);
        synced += 1;
      } catch (err) {
        console.error(`[Gmail Sync] Failed message ${id}:`, err.message);
      }
    }

    await pool.query(
      `INSERT INTO email_sync_state (account_id, history_id, last_sync_at, messages_synced, last_sync_error)
       VALUES ($1, $2, NOW(), $3, NULL)
       ON CONFLICT (account_id) DO UPDATE SET
         history_id = EXCLUDED.history_id,
         last_sync_at = NOW(),
         messages_synced = email_sync_state.messages_synced + EXCLUDED.messages_synced,
         last_sync_error = NULL,
         updated_at = NOW()`,
      [accountId, currentHistoryId, synced]
    );

    await pool.query(
      `UPDATE email_accounts SET
         sync_status = 'idle',
         history_id = $2,
         last_sync_at = NOW(),
         last_sync_error = NULL,
         updated_at = NOW()
       WHERE id = $1`,
      [accountId, currentHistoryId]
    );

    return { synced, historyId: currentHistoryId, reclassified: await reclassifyPending(account.user_id, accountId) };
  } catch (err) {
    await pool.query(
      `UPDATE email_accounts SET sync_status = 'error', last_sync_error = $2, updated_at = NOW() WHERE id = $1`,
      [accountId, err.message]
    );
    await pool.query(
      `INSERT INTO email_sync_state (account_id, last_sync_error, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (account_id) DO UPDATE SET last_sync_error = EXCLUDED.last_sync_error, updated_at = NOW()`,
      [accountId, err.message]
    );
    throw err;
  }
}

async function syncAllAccounts() {
  const result = await pool.query(
    `SELECT id, user_id FROM email_accounts WHERE is_active = TRUE AND sync_status != 'syncing'`
  );
  const outcomes = [];
  for (const row of result.rows) {
    try {
      const res = await syncAccount(row.id, row.user_id);
      outcomes.push({ accountId: row.id, success: true, ...res });
    } catch (err) {
      outcomes.push({ accountId: row.id, success: false, error: err.message });
    }
  }
  return outcomes;
}

module.exports = { syncAccount, syncAllAccounts, processMessage };

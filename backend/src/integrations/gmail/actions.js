const pool = require('../../db');
const { getGmailClient } = require('./client');
const { assertEmailOwnership } = require('../../email/security/permissions');
const { learnFromAction } = require('../../email/learning/senderProfiles');

async function logAction(userId, emailId, accountId, actionType, actor, metadata = {}) {
  await pool.query(
    `INSERT INTO email_actions (user_id, email_id, account_id, action_type, actor, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, emailId, accountId, actionType, actor, JSON.stringify(metadata)]
  );
}

async function archiveEmail(userId, emailId, actor = 'user') {
  const email = await assertEmailOwnership(userId, emailId);
  const { gmail } = await getGmailClient(email.account_id, userId);
  const row = await pool.query('SELECT gmail_message_id FROM emails WHERE id = $1', [emailId]);
  const gmailId = row.rows[0].gmail_message_id;

  await gmail.users.messages.modify({
    userId: 'me',
    id: gmailId,
    requestBody: { removeLabelIds: ['INBOX'] },
  });

  await logAction(userId, emailId, email.account_id, 'archive', actor);
  const fullEmail = (await pool.query('SELECT * FROM emails WHERE id = $1', [emailId])).rows[0];
  await learnFromAction(userId, fullEmail, 'archive');
  return { success: true, action: 'archive' };
}

async function deleteEmail(userId, emailId, actor = 'user') {
  const email = await assertEmailOwnership(userId, emailId);
  const { gmail } = await getGmailClient(email.account_id, userId);
  const row = await pool.query('SELECT gmail_message_id FROM emails WHERE id = $1', [emailId]);
  const gmailId = row.rows[0].gmail_message_id;

  await gmail.users.messages.trash({ userId: 'me', id: gmailId });

  await logAction(userId, emailId, email.account_id, 'delete', actor);
  const fullEmail = (await pool.query('SELECT * FROM emails WHERE id = $1', [emailId])).rows[0];
  await learnFromAction(userId, fullEmail, 'delete');
  return { success: true, action: 'delete' };
}

async function markImportant(userId, emailId, actor = 'user') {
  const email = await assertEmailOwnership(userId, emailId);
  const { gmail } = await getGmailClient(email.account_id, userId);
  const row = await pool.query('SELECT gmail_message_id FROM emails WHERE id = $1', [emailId]);
  const gmailId = row.rows[0].gmail_message_id;

  await gmail.users.messages.modify({
    userId: 'me',
    id: gmailId,
    requestBody: { addLabelIds: ['IMPORTANT', 'STARRED'] },
  });

  await pool.query('UPDATE emails SET is_starred = TRUE WHERE id = $1', [emailId]);
  await pool.query(
    `INSERT INTO email_classifications (email_id, user_id, category, confidence, source, evidence)
     VALUES ($1, $2, 'IMPORTANT', 1.0, 'manual', '{"reason":"user marked important"}')
     ON CONFLICT (email_id) DO UPDATE SET category = 'IMPORTANT', source = 'manual', confidence = 1.0, updated_at = NOW()`,
    [emailId, userId]
  );

  await logAction(userId, emailId, email.account_id, 'mark_important', actor);
  const fullEmail = (await pool.query('SELECT * FROM emails WHERE id = $1', [emailId])).rows[0];
  await learnFromAction(userId, fullEmail, 'mark_important');
  return { success: true, action: 'mark_important' };
}

async function muteSender(userId, emailId, actor = 'user') {
  const email = await assertEmailOwnership(userId, emailId);
  const fullEmail = (await pool.query('SELECT * FROM emails WHERE id = $1', [emailId])).rows[0];

  await pool.query('UPDATE emails SET is_muted = TRUE WHERE from_address = $1 AND user_id = $2', [
    fullEmail.from_address,
    userId,
  ]);

  await pool.query(
    `INSERT INTO email_rules (user_id, name, match_sender, category, action, priority)
     VALUES ($1, $2, $3, 'SPAM', 'mute', 100)`,
    [userId, `Mute ${fullEmail.from_address}`, fullEmail.from_address]
  );

  await logAction(userId, emailId, email.account_id, 'mute_sender', actor, {
    sender: fullEmail.from_address,
  });
  await learnFromAction(userId, fullEmail, 'mute');
  return { success: true, action: 'mute_sender' };
}

module.exports = {
  archiveEmail,
  deleteEmail,
  markImportant,
  muteSender,
  logAction,
};

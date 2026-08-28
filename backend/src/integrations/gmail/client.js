const { google } = require('googleapis');
const pool = require('../../db');
const { decrypt, encrypt } = require('./crypto');
const { getOAuthClient } = require('./oauth');

async function getAccountRow(accountId, userId) {
  const result = await pool.query(
    `SELECT * FROM email_accounts WHERE id = $1 AND user_id = $2 AND is_active = TRUE`,
    [accountId, userId]
  );
  if (result.rowCount === 0) throw new Error('Email account not found');
  return result.rows[0];
}

async function persistTokens(accountId, tokens) {
  const encryptedAccess = tokens.access_token ? encrypt(tokens.access_token) : null;
  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
  await pool.query(
    `UPDATE email_accounts SET
       encrypted_access_token = COALESCE($2, encrypted_access_token),
       token_expires_at = COALESCE($3, token_expires_at),
       updated_at = NOW()
     WHERE id = $1`,
    [accountId, encryptedAccess, expiresAt]
  );
}

async function getGmailClient(accountId, userId) {
  const account = await getAccountRow(accountId, userId);
  const oauth2 = getOAuthClient();

  const refreshToken = decrypt(account.encrypted_refresh_token);
  const accessToken = account.encrypted_access_token
    ? decrypt(account.encrypted_access_token)
    : null;

  oauth2.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken,
    expiry_date: account.token_expires_at ? new Date(account.token_expires_at).getTime() : null,
  });

  oauth2.on('tokens', (tokens) => {
    persistTokens(accountId, tokens).catch((err) => {
      console.error('[Gmail] Failed to persist refreshed tokens:', err.message);
    });
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2 });
  return { gmail, account };
}

module.exports = { getGmailClient, getAccountRow };

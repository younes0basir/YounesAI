const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const pool = require('../../db');
const { encrypt } = require('./crypto');
const { GMAIL_SCOPES, getMaxAccountsPerUser } = require('../../email/constants');

const JWT_SECRET = process.env.JWT_SECRET;

function getOAuthClient() {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_GMAIL_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Gmail OAuth is not configured (GOOGLE_GMAIL_CLIENT_ID/SECRET/REDIRECT_URI)');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function buildAuthUrl(userId) {
  const oauth2 = getOAuthClient();
  const state = jwt.sign({ userId, purpose: 'gmail_connect' }, JWT_SECRET, { expiresIn: '15m' });
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state,
  });
  return { url, state };
}

function verifyState(state) {
  const decoded = jwt.verify(state, JWT_SECRET);
  if (decoded.purpose !== 'gmail_connect' || !decoded.userId) {
    throw new Error('Invalid OAuth state');
  }
  return decoded.userId;
}

async function handleCallback(code, state) {
  const userId = verifyState(state);
  const oauth2 = getOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
  const profile = await oauth2Api.userinfo.get();
  const emailAddress = profile.data.email;
  if (!emailAddress) throw new Error('Could not retrieve Gmail address');

  const countRes = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM email_accounts WHERE user_id = $1 AND is_active = TRUE',
    [userId]
  );
  const userRes = await pool.query('SELECT plan_tier FROM users WHERE id = $1', [userId]);
  const planTier = userRes.rows[0]?.plan_tier || 'starter';
  const maxAccounts = getMaxAccountsPerUser(planTier);
  if (countRes.rows[0].cnt >= maxAccounts) {
    throw new Error(`Maximum of ${maxAccounts} Gmail accounts allowed`);
  }

  let encryptedRefresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

  const existing = await pool.query(
    'SELECT id, encrypted_refresh_token FROM email_accounts WHERE user_id = $1 AND email_address = $2',
    [userId, emailAddress]
  );

  if (!encryptedRefresh && existing.rowCount > 0) {
    encryptedRefresh = existing.rows[0].encrypted_refresh_token;
  }
  if (!encryptedRefresh) {
    throw new Error(
      'No refresh token received — revoke app access in Google Account and reconnect'
    );
  }

  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

  const encryptedAccess = tokens.access_token ? encrypt(tokens.access_token) : null;

  const result = await pool.query(
    `INSERT INTO email_accounts
       (user_id, email_address, display_name, encrypted_access_token, encrypted_refresh_token, token_expires_at, sync_status)
     VALUES ($1, $2, $3, $4, $5, $6, 'idle')
     ON CONFLICT (user_id, email_address) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       encrypted_access_token = COALESCE(EXCLUDED.encrypted_access_token, email_accounts.encrypted_access_token),
       encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
       token_expires_at = EXCLUDED.token_expires_at,
       is_active = TRUE,
       sync_status = 'idle',
       last_sync_error = NULL,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      emailAddress,
      profile.data.name || emailAddress,
      encryptedAccess,
      encryptedRefresh,
      expiresAt,
    ]
  );

  return { account: result.rows[0], userId };
}

async function disconnectAccount(userId, accountId) {
  const result = await pool.query(
    `UPDATE email_accounts SET is_active = FALSE, sync_status = 'idle', updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [accountId, userId]
  );
  return result.rowCount > 0;
}

async function listAccounts(userId) {
  const result = await pool.query(
    `SELECT id, email_address, display_name, sync_status, last_sync_at, last_sync_error, is_active, created_at
     FROM email_accounts
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows;
}

module.exports = {
  buildAuthUrl,
  handleCallback,
  disconnectAccount,
  listAccounts,
  getOAuthClient,
};

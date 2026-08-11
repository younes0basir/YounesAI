const pool = require('../../db');

async function assertAccountOwnership(userId, accountId) {
  const result = await pool.query(
    'SELECT id FROM email_accounts WHERE id = $1 AND user_id = $2 AND is_active = TRUE',
    [accountId, userId]
  );
  if (result.rowCount === 0) throw new Error('Email account not found or access denied');
  return result.rows[0].id;
}

async function assertEmailOwnership(userId, emailId) {
  const result = await pool.query(
    'SELECT id, account_id FROM emails WHERE id = $1 AND user_id = $2',
    [emailId, userId]
  );
  if (result.rowCount === 0) throw new Error('Email not found or access denied');
  return result.rows[0];
}

module.exports = { assertAccountOwnership, assertEmailOwnership };

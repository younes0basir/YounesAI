const pool = require('../db');
const { summarizeEmailContent } = require('../agents/email/summarizer');

async function summarizeEmail({ userId, emailId }) {
  const result = await pool.query('SELECT * FROM emails WHERE id = $1 AND user_id = $2', [
    emailId,
    userId,
  ]);
  if (result.rowCount === 0) {
    return { success: false, error: 'Email not found' };
  }

  return summarizeEmailContent(result.rows[0]);
}

module.exports = summarizeEmail;

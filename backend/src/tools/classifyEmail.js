const pool = require('../db');
const { classifyEmail } = require('../agents/email/pipeline');

async function classifyEmailTool({ userId, emailId }) {
  const result = await pool.query(
    'SELECT * FROM emails WHERE id = $1 AND user_id = $2',
    [emailId, userId]
  );
  if (result.rowCount === 0) {
    return { success: false, error: 'Email not found' };
  }
  const classification = await classifyEmail(userId, result.rows[0]);
  return { success: true, classification };
}

module.exports = classifyEmailTool;

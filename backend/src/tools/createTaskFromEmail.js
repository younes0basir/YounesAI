const pool = require('../db');
const createTask = require('./createTask');

async function createTaskFromEmail({ userId, emailId, title, priority }) {
  const result = await pool.query(
    'SELECT * FROM emails WHERE id = $1 AND user_id = $2',
    [emailId, userId]
  );
  if (result.rowCount === 0) {
    return { success: false, error: 'Email not found' };
  }
  const email = result.rows[0];
  return createTask(
    { userId, requestId: null },
    {
      title: title || `Follow up: ${email.subject || 'Email'}`,
      description: `From: ${email.from_address}\n\n${email.snippet || email.body_text || ''}`,
      priority: priority || 3,
      status: 'pending',
    }
  );
}

module.exports = createTaskFromEmail;

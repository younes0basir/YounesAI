const pool = require('../db');

async function deleteReminder(context, id) {
  try {
    const result = await pool.query(
      `DELETE FROM reminders
       WHERE id = $1 AND user_id = $2
       RETURNING id, title`,
      [id, context.userId]
    );

    if (result.rowCount === 0) {
      return { success: false, error: 'Reminder not found or unauthorized' };
    }

    return { success: true, reminder: result.rows[0] };
  } catch (err) {
    throw err;
  }
}

module.exports = deleteReminder;

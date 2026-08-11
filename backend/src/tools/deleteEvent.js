const pool = require('../db');

async function deleteEvent(context, id) {
  const result = await pool.query(
    `DELETE FROM calendar_events WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, context.userId]
  );
  if (result.rowCount === 0) return { success: false, error: 'Event not found' };
  return { success: true, deleted: true };
}

module.exports = deleteEvent;

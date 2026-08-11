const pool = require('../db');

async function deleteTask(context, id) {
  const result = await pool.query(
    `UPDATE tasks SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, context.userId]
  );
  if (result.rowCount === 0) return { success: false, error: 'Task not found' };
  return { success: true, deleted: true };
}

module.exports = deleteTask;

const pool = require('../db');

async function listTasks(context, filters = {}) {
  const where = ['user_id = $1', 'deleted_at IS NULL'];
  const params = [context.userId];
  let idx = 2;

  if (filters.status) {
    where.push(`status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.priority) {
    where.push(`priority = $${idx++}`);
    params.push(Number(filters.priority));
  }
  if (filters.filter === 'today') {
    where.push('due_at IS NOT NULL AND DATE(due_at) = CURRENT_DATE');
  }
  if (filters.filter === 'overdue') {
    where.push("status != 'done' AND due_at IS NOT NULL AND due_at < NOW()");
  }

  const result = await pool.query(
    `SELECT id, title, description, status, priority, due_at, created_at FROM tasks WHERE ${where.join(' AND ')} ORDER BY due_at ASC NULLS LAST LIMIT 50`,
    params
  );
  return { success: true, tasks: result.rows };
}

module.exports = listTasks;

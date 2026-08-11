const pool = require('../db');

// Whitelist of allowed columns for task updates
const ALLOWED_FIELDS = new Set([
  'title', 'description', 'details', 'priority', 'urgency', 'due_at',
  'status', 'checklist', 'is_favorite', 'recurrence_rule', 'recurrence_interval',
  'next_run_at', 'completed_at', 'parent_task_id', 'project_id', 'quadrant',
]);

async function updateTask(context, id, data) {
  if (!id) return { success: false, error: 'Task ID is required' };
  if (!data || typeof data !== 'object') return { success: false, error: 'No fields to update' };

  const sets = [];
  const params = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (!ALLOWED_FIELDS.has(key)) continue; // skip unknown/protected fields
    sets.push(`${key} = $${idx++}`);
    params.push(key === 'checklist' ? JSON.stringify(value || []) : value);
  }

  if (sets.length === 0) return { success: false, error: 'No fields to update' };

  params.push(id, context.userId);
  const result = await pool.query(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING id, title, status, priority, due_at, updated_at`,
    params
  );

  if (result.rowCount === 0) return { success: false, error: 'Task not found' };
  return { success: true, task: result.rows[0] };
}

module.exports = updateTask;

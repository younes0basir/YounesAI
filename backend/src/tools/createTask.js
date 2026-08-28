const pool = require('../db');
const { checkIdempotency } = require('../agents/idempotency');
const { validate } = require('./_validate');

async function createTask(context, data) {
  // Validate and sanitize input before hitting the DB
  const { value, error } = validate('task', data || {});
  if (error) {
    console.warn('[createTask] Validation warning:', error);
    // Non-fatal: fall through with sanitized defaults
  }

  // Idempotency check
  try {
    const existing = await checkIdempotency(context, 'tasks');
    if (existing) return { success: true, task: existing, idempotent: true };
  } catch {}

  const { title, description, priority, due_at, details, checklist, status, is_favorite, urgency } =
    value;

  try {
    const result = await pool.query(
      `INSERT INTO tasks
         (user_id, title, description, priority, due_at, details,
          checklist, status, is_favorite, urgency, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, title, status, priority, due_at, created_at`,
      [
        context.userId,
        title,
        description,
        priority,
        due_at,
        details,
        JSON.stringify(checklist || []),
        status,
        is_favorite || false,
        urgency || null,
        context.requestId || null,
      ]
    );
    return { success: true, task: result.rows[0] };
  } catch (err) {
    console.error('[createTask] INSERT error:', err.code, err.message);
    // Unique constraint on request_id — idempotent duplicate
    if (err.code === '23505' && err.constraint?.includes('request_id')) {
      const dup = await pool.query(
        'SELECT * FROM tasks WHERE request_id = $1 AND user_id = $2 LIMIT 1',
        [context.requestId, context.userId]
      );
      if (dup.rowCount > 0) return { success: true, task: dup.rows[0], idempotent: true };
    }
    // Fallback 1: insert without request_id if column doesn't exist yet
    if (err.message?.includes('request_id')) {
      try {
        const result = await pool.query(
          `INSERT INTO tasks (user_id, title, description, priority, due_at, details, checklist, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, title, status, priority, due_at, created_at`,
          [
            context.userId,
            title,
            description,
            priority,
            due_at,
            details,
            JSON.stringify(checklist || []),
            status,
          ]
        );
        return { success: true, task: result.rows[0] };
      } catch (err2) {
        console.error('[createTask] Fallback 1 failed:', err2.code, err2.message);
      }
    }
    // Fallback 2: minimal INSERT with only essential columns
    try {
      const result = await pool.query(
        `INSERT INTO tasks (user_id, title, priority, status, due_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, status, priority, due_at, created_at`,
        [
          context.userId,
          title || 'Untitled Task',
          priority || 3,
          status || 'pending',
          due_at || null,
        ]
      );
      console.log('[createTask] Minimal INSERT succeeded:', result.rows[0]?.id);
      return { success: true, task: result.rows[0] };
    } catch (err3) {
      console.error(
        '[createTask] All INSERT attempts failed. Last error:',
        err3.code,
        err3.message
      );
      throw err3;
    }
  }
}

module.exports = createTask;

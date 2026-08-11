const pool = require('../db');
const { checkIdempotency } = require('../agents/idempotency');
const { validate } = require('./_validate');

async function createReminder(context, data) {
  const { value, error } = validate('reminder', data || {});
  if (error) {
    console.warn('[createReminder] Validation warning:', error);
  }

  try {
    const existing = await checkIdempotency(context, 'reminders');
    if (existing) return { success: true, reminder: existing, idempotent: true };
  } catch {}

  const { title, message, trigger_at, task_id, event_id, recurrence_rule } = value;

  try {
    const result = await pool.query(
      `INSERT INTO reminders (user_id, title, message, trigger_at, task_id, event_id, recurrence_rule, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, trigger_at, created_at`,
      [context.userId, title, message, trigger_at, task_id, event_id, recurrence_rule, context.requestId || null]
    );
    return { success: true, reminder: result.rows[0] };
  } catch (err) {
    if (err.code === '23505' && err.constraint?.includes('request_id')) {
      const dup = await pool.query(
        'SELECT * FROM reminders WHERE request_id = $1 AND user_id = $2 LIMIT 1',
        [context.requestId, context.userId]
      );
      if (dup.rowCount > 0) return { success: true, reminder: dup.rows[0], idempotent: true };
    }

    if (err.message && err.message.includes('request_id')) {
      const result = await pool.query(
        `INSERT INTO reminders (user_id, title, message, trigger_at, task_id, event_id, recurrence_rule)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, title, trigger_at, created_at`,
        [context.userId, title, message, trigger_at, task_id, event_id, recurrence_rule]
      );
      return { success: true, reminder: result.rows[0] };
    }
    throw err;
  }
}

module.exports = createReminder;

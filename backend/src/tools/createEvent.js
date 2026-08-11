const pool = require('../db');
const { checkIdempotency } = require('../agents/idempotency');
const { validate } = require('./_validate');

async function createEvent(context, data) {
  const { value, error } = validate('event', data || {});
  if (error) {
    console.warn('[createEvent] Validation warning:', error);
  }

  try {
    const existing = await checkIdempotency(context, 'calendar_events');
    if (existing) return { success: true, event: existing, idempotent: true };
  } catch {}

  let { title, description, starts_at, ends_at, is_all_day, color, location_text, recurrence_rule } = value;

  // Defensive defaults: never let the DB NOT NULL constraint fail because the LLM omitted dates
  if (!starts_at) {
    starts_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }
  if (!ends_at) {
    ends_at = new Date(new Date(starts_at).getTime() + 60 * 60 * 1000).toISOString();
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO calendar_events (user_id, title, description, starts_at, ends_at, is_all_day, color, location_text, recurrence_rule, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, title, starts_at, ends_at, color, created_at`,
      [context.userId, title, description, starts_at, ends_at, is_all_day, color, location_text, recurrence_rule, context.requestId || null]
    );
    return { success: true, event: result.rows[0] };
  } catch (err) {
    if (err.code === '23505' && err.constraint?.includes('request_id')) {
      const dup = await pool.query(
        'SELECT * FROM calendar_events WHERE request_id = $1 AND user_id = $2 LIMIT 1',
        [context.requestId, context.userId]
      );
      if (dup.rowCount > 0) return { success: true, event: dup.rows[0], idempotent: true };
    }
    
    if (err.message && err.message.includes('request_id')) {
      const result = await pool.query(
        `INSERT INTO calendar_events (user_id, title, description, starts_at, ends_at, is_all_day, color, location_text, recurrence_rule)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, title, starts_at, ends_at, color, created_at`,
        [context.userId, title, description, starts_at, ends_at, is_all_day, color, location_text, recurrence_rule]
      );
      return { success: true, event: result.rows[0] };
    }
    throw err;
  }
}

module.exports = createEvent;

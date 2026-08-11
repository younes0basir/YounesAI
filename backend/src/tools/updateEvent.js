const pool = require('../db');

// Whitelist of allowed columns for event updates
const ALLOWED_FIELDS = new Set([
  'title', 'description', 'starts_at', 'ends_at', 'is_all_day',
  'color', 'location_text', 'recurrence_rule', 'place_id',
]);

async function updateEvent(context, id, data) {
  if (!id) return { success: false, error: 'Event ID is required' };
  if (!data || typeof data !== 'object') return { success: false, error: 'No fields to update' };

  const sets = [];
  const params = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (!ALLOWED_FIELDS.has(key)) continue; // skip unknown/protected fields
    sets.push(`${key} = $${idx++}`);
    params.push(value);
  }

  if (sets.length === 0) return { success: false, error: 'No fields to update' };

  params.push(id, context.userId);
  const result = await pool.query(
    `UPDATE calendar_events SET ${sets.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING id, title, starts_at, ends_at`,
    params
  );

  if (result.rowCount === 0) return { success: false, error: 'Event not found' };
  return { success: true, event: result.rows[0] };
}

module.exports = updateEvent;

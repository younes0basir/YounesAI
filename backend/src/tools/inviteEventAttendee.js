const pool = require('../db');

async function inviteEventAttendee(context, eventId, { name, email = null, userId = null }) {
  if (!eventId) return { success: false, error: 'Event ID is required' };
  if (!name && !email) return { success: false, error: 'Attendee name or email is required' };

  const eventCheck = await pool.query(
    'SELECT id, title FROM calendar_events WHERE id = $1 AND user_id = $2',
    [eventId, context.userId]
  );
  if (eventCheck.rowCount === 0) return { success: false, error: 'Event not found' };

  const result = await pool.query(
    `INSERT INTO event_attendees (event_id, name, email, user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [eventId, name || email, email, userId]
  );

  return { success: true, attendee: result.rows[0], event: eventCheck.rows[0] };
}

module.exports = inviteEventAttendee;

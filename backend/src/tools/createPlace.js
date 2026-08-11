const pool = require('../db');
const { validate } = require('./_validate');

async function createPlace(context, data) {
  const { value, error } = validate('place', data || {});
  if (error) {
    console.warn('[createPlace] Validation warning:', error);
  }

  const { name, address, category, notes, latitude, longitude, urgency, is_visited } = value;

  try {
    const result = await pool.query(
      `INSERT INTO places (user_id, name, address, category, notes, latitude, longitude, urgency, is_visited)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, category, is_visited, created_at`,
      [context.userId, name, address, category, notes, latitude, longitude, urgency, is_visited]
    );
    return { success: true, place: result.rows[0] };
  } catch (err) {
    throw err;
  }
}

module.exports = createPlace;

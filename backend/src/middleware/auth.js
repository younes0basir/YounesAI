const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      'SELECT id, email, plan_tier, is_admin FROM users WHERE id = $1',
      [decoded.id]
    );
    if (!result.rowCount) return res.status(401).json({ error: 'User not found' });

    const user = result.rows[0];
    req.user = {
      id: user.id,
      email: user.email,
      plan: user.plan_tier || 'starter',
      is_admin: Boolean(user.is_admin),
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authMiddleware };

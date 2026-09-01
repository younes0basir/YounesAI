const { Router } = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { PLAN_TIERS, normalizeTier, getPlanCatalog } = require('../plans/config');
const { buildUsageSummary } = require('../services/usageService');

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const HARDCODED_ADMINS = ['vodbo2001@gmail.com'];

function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .concat(HARDCODED_ADMINS.map((e) => e.toLowerCase()));
}

async function adminAuth(req, res, next) {
  const adminKey = process.env.ADMIN_API_KEY;
  const provided = req.headers['x-admin-key'];

  // 1) Legacy header auth — still supported for scripts / curl / frontend key field
  if (adminKey && provided && provided === adminKey) {
    return next();
  }

  // 2) JWT-based admin — allows vodbo2001@gmail.com (and any future is_admin users) to use normal login
  const authHeader = req.headers.authorization;
  if (authHeader && JWT_SECRET) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await pool.query('SELECT id, email, is_admin FROM users WHERE id = $1', [
          decoded.id,
        ]);
        if (result.rowCount) {
          const u = result.rows[0];
          const adminEmails = getAdminEmails();
          if (u.is_admin || adminEmails.includes(String(u.email || '').toLowerCase())) {
            req.user = { id: u.id, email: u.email, is_admin: true };
            return next();
          }
        }
      } catch (_) {
        // fall through to 401
      }
    }
  }

  // 3) No valid auth — give actionable error
  if (!adminKey && !authHeader) {
    return res.status(503).json({ error: 'Admin API is not configured and no admin JWT provided' });
  }
  return res.status(401).json({ error: 'Unauthorized - admin access required' });
}

// GET /api/admin/users — list users with plan + today's usage (admin only)
router.get('/users', adminAuth, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
    const today = new Date().toISOString().slice(0, 10);

    let where = '';
    const params = [];
    let paramIdx = 1;

    if (search) {
      where = `WHERE u.email ILIKE $${paramIdx} OR u.display_name ILIKE $${paramIdx}`;
      params.push(`%${search}%`);
      paramIdx += 1;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM users u ${where}`,
      params
    );
    const total = countResult.rows[0]?.total ?? 0;

    const dataResult = await pool.query(
      `SELECT
         u.id, u.email, u.display_name, u.plan_tier, u.is_admin, u.plan_updated_at, u.created_at,
          COALESCE(uc.ai_chat_count, 0) AS ai_chat_count,
          COALESCE(uc.voice_count, 0)   AS voice_count,
          COALESCE(uc.image_count, 0)   AS image_count
        FROM users u
        LEFT JOIN usage_counters uc
          ON uc.user_id = u.id AND uc.period_date = $${paramIdx}
        ${where}
        ORDER BY u.created_at DESC
        LIMIT $${paramIdx + 1} OFFSET $${paramIdx + 2}`,
      [...params, today, limit, offset]
    );

    const users = dataResult.rows.map((row) => {
      const tier = normalizeTier(row.plan_tier);
      const { usage, limits } = buildUsageSummary(tier, row);
      return {
        id: row.id,
        email: row.email,
        display_name: row.display_name,
        plan_tier: tier,
        is_admin: Boolean(row.is_admin),
        plan_updated_at: row.plan_updated_at,
        created_at: row.created_at,
        usage,
        limits,
      };
    });

    res.json({ users, total, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stats — aggregate counts by tier + today's usage totals
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [tierCounts, usageTotals, planCatalog] = await Promise.all([
      pool.query(`SELECT plan_tier, COUNT(*)::int AS count FROM users GROUP BY plan_tier`),
      pool.query(
        `SELECT COALESCE(SUM(ai_chat_count),0)::int AS ai_chat_total,
                COALESCE(SUM(voice_count),0)::int   AS voice_total,
                COALESCE(SUM(image_count),0)::int   AS image_total
         FROM usage_counters WHERE period_date = $1`,
        [today]
      ),
      Promise.resolve(getPlanCatalog()),
    ]);

    const byTier = {};
    for (const r of tierCounts.rows) byTier[normalizeTier(r.plan_tier)] = r.count;
    for (const t of PLAN_TIERS) if (!(t in byTier)) byTier[t] = 0;

    const totalUsersResult = await pool.query(`SELECT COUNT(*)::int AS total FROM users`);
    res.json({
      totalUsers: totalUsersResult.rows[0].total,
      byTier,
      todayUsage: usageTotals.rows[0],
      plans: planCatalog,
      date: today,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id/plan', adminAuth, async (req, res) => {
  try {
    const { plan_tier } = req.body || {};
    const normalized = normalizeTier(plan_tier);
    if (!plan_tier || !PLAN_TIERS.includes(normalized)) {
      return res.status(400).json({
        error: 'Invalid plan_tier',
        allowed: PLAN_TIERS,
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET plan_tier = $1, plan_updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, display_name, plan_tier, is_admin, plan_updated_at, created_at`,
      [normalized, req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

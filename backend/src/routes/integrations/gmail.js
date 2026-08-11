const { Router } = require('express');
const { authMiddleware } = require('../../middleware/auth');
const {
  buildAuthUrl,
  handleCallback,
  disconnectAccount,
  listAccounts,
} = require('../../integrations/gmail/oauth');
const { syncAccount } = require('../../integrations/gmail/sync');
const pool = require('../../db');

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

router.get('/connect', authMiddleware, (req, res) => {
  try {
    const { url } = buildAuthUrl(req.user.id);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(`${FRONTEND_URL}/settings?gmail=error&message=${encodeURIComponent(error)}`);
    }
    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/settings?gmail=error&message=missing_code`);
    }
    await handleCallback(code, state);
    res.redirect(`${FRONTEND_URL}/settings?gmail=connected`);
  } catch (err) {
    res.redirect(`${FRONTEND_URL}/settings?gmail=error&message=${encodeURIComponent(err.message)}`);
  }
});

router.get('/accounts', authMiddleware, async (req, res) => {
  try {
    const accounts = await listAccounts(req.user.id);
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/accounts/:id', authMiddleware, async (req, res) => {
  try {
    const ok = await disconnectAccount(req.user.id, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Account not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync', authMiddleware, async (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) return res.status(400).json({ error: 'accountId required' });
    const result = await syncAccount(accountId, req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/all', authMiddleware, async (req, res) => {
  try {
    const accounts = await listAccounts(req.user.id);
    const results = [];
    for (const acc of accounts) {
      try {
        const r = await syncAccount(acc.id, req.user.id);
        results.push({ accountId: acc.id, success: true, ...r });
      } catch (err) {
        results.push({ accountId: acc.id, success: false, error: err.message });
      }
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sync/status', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ea.id, ea.email_address, ea.sync_status, ea.last_sync_at, ea.last_sync_error,
              ess.history_id, ess.messages_synced
       FROM email_accounts ea
       LEFT JOIN email_sync_state ess ON ess.account_id = ea.id
       WHERE ea.user_id = $1 AND ea.is_active = TRUE
       ORDER BY ea.created_at ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

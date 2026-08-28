const { Router } = require('express');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');
const {
  archiveEmail,
  deleteEmail,
  markImportant,
  muteSender,
} = require('../integrations/gmail/actions');
const { classifyEmail } = require('../agents/email/pipeline');
const { executeOrRequestApproval, listPending, resolveApproval } = require('../email/approvals');
const { EMAIL_CATEGORIES, AI_INBOX_CATEGORIES } = require('../email/constants');
const { summarizeEmailContent } = require('../agents/email');

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, view, accountId, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const where = ['e.user_id = $1'];
    const params = [userId];
    let idx = 2;

    if (view === 'ai') {
      where.push(`ec.category = ANY($${idx++})`);
      params.push(AI_INBOX_CATEGORIES);
    } else if (category && EMAIL_CATEGORIES.includes(category)) {
      where.push(`ec.category = $${idx++}`);
      params.push(category);
    }
    if (accountId) {
      where.push(`e.account_id = $${idx++}`);
      params.push(accountId);
    }

    params.push(parseInt(limit, 10), offset);

    const q = `
      SELECT e.*, ec.category, ec.confidence, ec.source AS classification_source, ec.evidence,
             ea.email_address AS account_email
      FROM emails e
      LEFT JOIN email_classifications ec ON ec.email_id = e.id
      LEFT JOIN email_accounts ea ON ea.id = e.account_id
      WHERE ${where.join(' AND ')}
      ORDER BY e.received_at DESC NULLS LAST
      LIMIT $${idx++} OFFSET $${idx}
    `;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/approvals/pending', authMiddleware, async (req, res) => {
  try {
    const approvals = await listPending(req.user.id);
    res.json(approvals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/approvals/:id/approve', authMiddleware, async (req, res) => {
  try {
    const result = await resolveApproval(req.user.id, req.params.id, true);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/approvals/:id/reject', authMiddleware, async (req, res) => {
  try {
    const result = await resolveApproval(req.user.id, req.params.id, false);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/rules', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM email_rules WHERE user_id = $1 ORDER BY priority DESC, created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rules', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      match_sender,
      match_domain,
      match_subject_contains,
      match_label,
      category,
      action,
      priority,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await pool.query(
      `INSERT INTO email_rules
         (user_id, name, match_sender, match_domain, match_subject_contains, match_label, category, action, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.user.id,
        name,
        match_sender || null,
        match_domain || null,
        match_subject_contains || null,
        match_label || null,
        category || null,
        action || 'classify',
        priority || 0,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/rules/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM email_rules WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const { action, emailIds } = req.body;
    if (!action || !Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({ error: 'action and emailIds required' });
    }
    const result = await executeOrRequestApproval(req.user.id, action, emailIds);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, ec.category, ec.confidence, ec.source AS classification_source, ec.evidence,
              ea.email_address AS account_email
       FROM emails e
       LEFT JOIN email_classifications ec ON ec.email_id = e.id
       LEFT JOIN email_accounts ea ON ea.id = e.account_id
       WHERE e.id = $1 AND e.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Email not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/actions', authMiddleware, async (req, res) => {
  try {
    const { action } = req.body;
    const userId = req.user.id;
    const emailId = req.params.id;

    const executors = {
      archive: archiveEmail,
      delete: deleteEmail,
      mark_important: markImportant,
      mute_sender: muteSender,
      reclassify: async (uid, eid) => {
        const row = await pool.query('SELECT * FROM emails WHERE id = $1 AND user_id = $2', [
          eid,
          uid,
        ]);
        if (row.rowCount === 0) throw new Error('Email not found');
        const classification = await classifyEmail(uid, row.rows[0]);
        return { success: true, classification };
      },
      summarize: async (uid, eid) => {
        const row = await pool.query('SELECT * FROM emails WHERE id = $1 AND user_id = $2', [
          eid,
          uid,
        ]);
        if (row.rowCount === 0) throw new Error('Email not found');
        return summarizeEmailContent(row.rows[0]);
      },
      create_task: async (uid, eid) => {
        const createTaskFromEmail = require('../tools/createTaskFromEmail');
        return createTaskFromEmail({ userId: uid, emailId: eid });
      },
    };

    const fn = executors[action];
    if (!fn) return res.status(400).json({ error: `Unknown action: ${action}` });
    const result = await fn(userId, emailId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

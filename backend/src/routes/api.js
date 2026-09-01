const { Router } = require('express');
const multer = require('multer');
const os = require('os');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { createCrudRouter } = require('../lib/crud');
const { authMiddleware } = require('../middleware/auth');
const { enforceQuota, requirePlan, incrementUsageAfterSuccess } = require('../middleware/plan');
const { generateImage } = require('../services/imageGenerator');
const { getNews } = require('../services/news');

// Write uploads to the OS temp dir — writable on Vercel serverless functions
// (the repo dir is read-only there). Vercel mounts /tmp per instance.
const upload = multer({ dest: os.tmpdir() });

const router = Router();

router.get('/tasks/smart', authMiddleware, async (req, res) => {
  try {
    const { filter } = req.query;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const whereClauses = ['user_id = $1', 'deleted_at IS NULL'];
    const params = [userId];

    if (filter === 'today') {
      whereClauses.push('due_at IS NOT NULL');
      whereClauses.push('DATE(due_at) = CURRENT_DATE');
    } else if (filter === 'overdue') {
      whereClauses.push("status != 'done'");
      whereClauses.push('due_at IS NOT NULL');
      whereClauses.push('due_at < NOW()');
    } else if (filter === 'high_priority') {
      whereClauses.push('priority >= 4');
    }

    const q = `
      SELECT *
      FROM tasks
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY due_at ASC NULLS LAST, updated_at DESC
      LIMIT 200
    `;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', authMiddleware, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!q) return res.json({ query: '', tasks: [], files: [], places: [] });

    const like = `%${q}%`;
    const [tasks, files, places] = await Promise.all([
      pool.query(
        `
          SELECT id, title, description, due_at, status, priority
          FROM tasks
          WHERE user_id = $1
            AND deleted_at IS NULL
            AND (title ILIKE $2 OR description ILIKE $2 OR details ILIKE $2)
          ORDER BY updated_at DESC
          LIMIT 20
        `,
        [userId, like]
      ),
      pool.query(
        `
          SELECT id, name, path, extension, indexed_at
          FROM files
          WHERE user_id = $1
            AND is_deleted = FALSE
            AND (name ILIKE $2 OR path ILIKE $2)
          ORDER BY indexed_at DESC
          LIMIT 20
        `,
        [userId, like]
      ),
      pool.query(
        `
          SELECT id, name, address, category, notes
          FROM places
          WHERE user_id = $1
            AND (name ILIKE $2 OR address ILIKE $2 OR category ILIKE $2 OR notes ILIKE $2)
          ORDER BY updated_at DESC NULLS LAST, created_at DESC
          LIMIT 20
        `,
        [userId, like]
      ),
    ]);

    res.json({
      query: q,
      tasks: tasks.rows,
      files: files.rows,
      places: places.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reminders/:id/snooze', authMiddleware, async (req, res) => {
  try {
    const minutes = Number(req.body?.minutes || 10);
    const safeMinutes =
      Number.isFinite(minutes) && minutes > 0 ? Math.min(minutes, 7 * 24 * 60) : 10;
    const userId = req.user?.id;
    const q = `
      UPDATE reminders
      SET snoozed_until = NOW() + ($1::int * INTERVAL '1 minute'),
          is_read = FALSE
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `;
    const result = await pool.query(q, [safeMinutes, req.params.id, userId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Reminder not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/alerts/pending', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    const result = await pool.query(
      `SELECT id, type, title, body, entity_type, entity_id, created_at
       FROM notifications
       WHERE user_id = $1
         AND read_at IS NULL
         AND type IN ('reminder_warning', 'reminder_due', 'task_due', 'task_overdue')
         ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/image/generate',
  authMiddleware,
  requirePlan(['pro', 'platinum']),
  enforceQuota('image'),
  async (req, res) => {
    try {
      const { prompt, width, height, steps, seed } = req.body || {};

      if (!prompt || !String(prompt).trim()) {
        return res.status(400).json({ error: 'Prompt is required.' });
      }

      const result = await generateImage({
        prompt,
        width,
        height,
        steps,
        seed,
      });

      await incrementUsageAfterSuccess(req, 'image');
      res.json(result);
    } catch (err) {
      console.error('[image/generate] error:', err.message);
      const upstreamAuthFailure =
        /NVIDIA image generation authorization failed|Authorization failed|Forbidden/i.test(
          err.message || ''
        );
      res.status(upstreamAuthFailure ? 502 : 500).json({
        error: err.message || 'Image generation failed.',
      });
    }
  }
);

// ── System News ───────────────────────────────────────────────────────────────
router.get('/news', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '10', 10);
    const category = req.query.category || null;
    const result = getNews({ limit, category });
    res.json(result);
  } catch (err) {
    console.error('[news] error:', err.message);
    res.status(500).json({ error: 'Failed to load news.' });
  }
});

router.post('/reminders/:id/dismiss', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    const q = `
      UPDATE reminders
      SET dismissed_at = NOW(),
          is_read = TRUE
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    const result = await pool.query(q, [req.params.id, userId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Reminder not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    const q = `
      SELECT DISTINCT p.*
      FROM projects p
      LEFT JOIN project_memberships pm ON pm.project_id = p.id
      WHERE p.owner_id = $1 OR pm.user_id = $1
      ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
      LIMIT 200
    `;
    const result = await pool.query(q, [userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, description = null } = req.body || {};
    if (!name || !String(name).trim())
      return res.status(400).json({ error: 'Project name is required' });

    const inserted = await pool.query(
      'INSERT INTO projects (owner_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [userId, String(name).trim(), description]
    );
    const project = inserted.rows[0];
    await pool.query(
      `
        INSERT INTO project_memberships (project_id, user_id, role, invited_by)
        VALUES ($1, $2, 'owner', $2)
        ON CONFLICT (project_id, user_id) DO NOTHING
      `,
      [project.id, userId]
    );
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function isProjectOwnerOrMember(projectId, userId) {
  const result = await pool.query(
    `SELECT 1
     FROM projects p
     LEFT JOIN project_memberships pm ON pm.project_id = p.id
     WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)
     LIMIT 1`,
    [projectId, userId]
  );
  return result.rowCount > 0;
}

router.get('/projects/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    const result = await pool.query(
      `SELECT p.* FROM projects p
       LEFT JOIN project_memberships pm ON pm.project_id = p.id
       WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)
       LIMIT 1`,
      [req.params.id, userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/projects/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!(await isProjectOwnerOrMember(req.params.id, userId))) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const body = req.body || {};
    const allowed = ['name', 'description', 'status'];
    const entries = Object.entries(body).filter(([k, v]) => allowed.includes(k) && v !== undefined);
    if (entries.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
    const sets = entries.map(([k], i) => `"${k}" = $${i + 1}`);
    const vals = entries.map(([, v]) => v);
    const q = `UPDATE projects SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length + 1} RETURNING *`;
    const result = await pool.query(q, [...vals, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/projects/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!(await isProjectOwnerOrMember(req.params.id, userId))) {
      return res.status(404).json({ error: 'Project not found' });
    }
    await pool.query('DELETE FROM project_memberships WHERE project_id = $1', [req.params.id]);
    await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── User Profile (read/update own record only) ───────────────────────────────
router.get('/users/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/me', authMiddleware, async (req, res) => {
  try {
    const { display_name } = req.body || {};
    if (!display_name || !String(display_name).trim()) {
      return res.status(400).json({ error: 'display_name is required' });
    }
    const result = await pool.query(
      'UPDATE users SET display_name = $1 WHERE id = $2 RETURNING id, email, display_name, created_at',
      [String(display_name).trim(), req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Activity Log (scoped to projects the user owns or is a member of) ─────────
router.get('/activity_log', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const result = await pool.query(
      `SELECT al.*
       FROM activity_log al
       WHERE al.project_id IN (
         SELECT p.id FROM projects p
         LEFT JOIN project_memberships pm ON pm.project_id = p.id
         WHERE p.owner_id = $1 OR pm.user_id = $1
       )
       ORDER BY al.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── File Index ────────────────────────────────────────────────────────────────
router.post('/files/index', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { originalname, filename, mimetype, size, path: tmpPath } = req.file;
    const ext = path.extname(originalname).replace('.', '').toLowerCase() || '';
    const safePath = ext ? tmpPath + '.' + ext : tmpPath;

    if (ext) {
      fs.renameSync(tmpPath, safePath);
    }

    await pool.query(
      `INSERT INTO files (user_id, name, path, extension, mime_type, size_bytes, checksum)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [req.user.id, originalname, safePath, ext, mimetype, size, filename]
    );

    const { indexFile } = require('../desktop/folderWatcher');
    await indexFile(safePath, req.user.id);

    res.status(201).json({ success: true, name: originalname });
  } catch (err) {
    console.error('File index error:', err);
    res.status(500).json({ error: 'Indexing failed' });
  }
});

// ── Register file metadata without storing content ───────────────────────────
router.post('/files/register', authMiddleware, async (req, res) => {
  try {
    const { files: fileList } = req.body;
    if (!Array.isArray(fileList) || fileList.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const inserted = [];
    for (const f of fileList) {
      const ext = (f.extension || path.extname(f.name || '').replace('.', '')).toLowerCase();
      const result = await pool.query(
        `INSERT INTO files (user_id, name, path, extension, mime_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING RETURNING *`,
        [
          req.user.id,
          f.name,
          f.path || f.name,
          ext,
          f.mime_type || null,
          Number(f.size_bytes) || null,
        ]
      );
      if (result.rows.length > 0) inserted.push(result.rows[0]);
    }

    res.status(201).json({ registered: inserted.length, files: inserted });
  } catch (err) {
    console.error('File register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Register a folder + its files (web import) ──────────────────────────────
router.post('/files/register-folder', authMiddleware, async (req, res) => {
  try {
    const { folder_name, files: fileList } = req.body;
    if (!folder_name || !Array.isArray(fileList) || fileList.length === 0) {
      return res.status(400).json({ error: 'Folder name and files required' });
    }

    const folderPath = `web://${folder_name}`;

    const folderResult = await pool.query(
      `INSERT INTO indexed_folders (user_id, folder_path, is_active)
       VALUES ($1, $2, true)
       ON CONFLICT (user_id, folder_path) DO UPDATE SET is_active = true
       RETURNING *`,
      [req.user.id, folderPath]
    );

    const inserted = [];
    for (const f of fileList) {
      const ext = (f.extension || path.extname(f.name || '').replace('.', '')).toLowerCase();
      const result = await pool.query(
        `INSERT INTO files (user_id, name, path, extension, mime_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING RETURNING *`,
        [
          req.user.id,
          f.name,
          f.path || f.name,
          ext,
          f.mime_type || null,
          Number(f.size_bytes) || null,
        ]
      );
      if (result.rows.length > 0) inserted.push(result.rows[0]);
    }

    res.status(201).json({
      folder: folderResult.rows[0],
      registered: inserted.length,
      files: inserted,
    });
  } catch (err) {
    console.error('Folder register error:', err);
    res.status(500).json({ error: 'Folder registration failed' });
  }
});

// ── Bulk delete operations (must be before CRUD to avoid route capture) ──────
router.delete('/files/delete-all', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE files SET is_deleted = TRUE WHERE user_id = $1 AND is_deleted = FALSE`,
      [req.user.id]
    );
    res.json({ deleted: result.rowCount });
  } catch (err) {
    console.error('Delete all files error:', err);
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

router.delete('/indexed_folders/:id/cascade', authMiddleware, async (req, res) => {
  try {
    const folderResult = await pool.query(
      'SELECT folder_path FROM indexed_folders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (folderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const folderPath = folderResult.rows[0].folder_path;

    // Determine file path prefix to match
    let pathPrefix;
    if (folderPath.startsWith('web://')) {
      pathPrefix = folderPath.replace('web://', '') + '/';
    } else {
      pathPrefix = folderPath.replace(/[\\/]$/, '') + path.sep;
    }

    // Soft-delete all files belonging to this folder
    const fileResult = await pool.query(
      `UPDATE files SET is_deleted = TRUE
       WHERE user_id = $1 AND is_deleted = FALSE AND path LIKE $2 ESCAPE ''`,
      [req.user.id, pathPrefix + '%']
    );

    // Remove folder from indexed_folders
    const delResult = await pool.query(
      'DELETE FROM indexed_folders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    res.json({ deletedFiles: fileResult.rowCount, folderRemoved: delResult.rowCount > 0 });
  } catch (err) {
    console.error('Cascade delete folder error:', err);
    res.status(500).json({ error: 'Cascade delete failed' });
  }
});

// ── Standard CRUD Routes ──────────────────────────────────────────────────────
router.use('/devices', authMiddleware, createCrudRouter(pool, 'devices', { userScoped: true }));
router.use(
  '/tasks',
  authMiddleware,
  createCrudRouter(pool, 'tasks', { softDelete: 'deleted_at', userScoped: true })
);
router.use('/places', authMiddleware, createCrudRouter(pool, 'places', { userScoped: true }));
router.use(
  '/calendar_events',
  authMiddleware,
  createCrudRouter(pool, 'calendar_events', { userScoped: true })
);
router.use('/reminders', authMiddleware, createCrudRouter(pool, 'reminders', { userScoped: true }));
router.use('/geofences', authMiddleware, createCrudRouter(pool, 'geofences', { userScoped: true }));
router.use('/files', authMiddleware, createCrudRouter(pool, 'files', { userScoped: true }));
router.use(
  '/indexed_folders',
  authMiddleware,
  createCrudRouter(pool, 'indexed_folders', { userScoped: true })
);
router.use(
  '/agent_actions',
  authMiddleware,
  createCrudRouter(pool, 'agent_actions', { userScoped: true })
);
router.use(
  '/conversations',
  authMiddleware,
  createCrudRouter(pool, 'conversations', { userScoped: true })
);
router.use(
  '/ai_memories',
  authMiddleware,
  createCrudRouter(pool, 'ai_memories', { userScoped: true })
);
router.use(
  '/notifications',
  authMiddleware,
  createCrudRouter(pool, 'notifications', { userScoped: true })
);
router.use('/tags', authMiddleware, createCrudRouter(pool, 'tags', { userScoped: true }));
router.use(
  '/entity_tags',
  authMiddleware,
  createCrudRouter(pool, 'entity_tags', { userScoped: true })
);
router.use(
  '/saved_views',
  authMiddleware,
  createCrudRouter(pool, 'saved_views', { userScoped: true })
);
router.use('/comments', authMiddleware, createCrudRouter(pool, 'comments', { userScoped: true }));

// Collaboration tables — project_memberships and task_assignments filtered via project membership middleware
router.use(
  '/project_memberships',
  authMiddleware,
  createCrudRouter(pool, 'project_memberships', { userScoped: true })
);
router.use(
  '/task_assignments',
  authMiddleware,
  createCrudRouter(pool, 'task_assignments', { userScoped: true })
);

// Projects — custom owner/member-scoped routes are defined above.

module.exports = router;

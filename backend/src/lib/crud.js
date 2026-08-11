const { Router } = require('express');

// Create a simple CRUD router for a table.
// options: { idCol: 'id', cols: ['col1','col2'], softDelete: 'deleted_at' }
function createCrudRouter(pool, table, options = {}) {
  const router = Router();
  const idCol = options.idCol || 'id';
  const cols = options.cols || null; // null => select *
  const softDelete = options.softDelete || null;
  const userScoped = options.userScoped || false;

  // fetch and cache column names for the table to validate incoming fields
  let allowedColumns = null;
  async function loadColumns() {
    if (allowedColumns) return allowedColumns;
    const q = `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`;
    const r = await pool.query(q, [table]);
    allowedColumns = r.rows.map(r => r.column_name);
    return allowedColumns;
  }

  async function normalizePayload(data, req) {
    const colsList = await loadColumns();
    const payload = {};

    if (userScoped && req?.user?.id && colsList.includes('user_id')) {
      payload.user_id = req.user.id;
    }

    for (const key of Object.keys(data || {})) {
      if (key === idCol) continue;
      if (!colsList.includes(key)) continue;
      if (key === 'user_id') continue;

      let value = data[key];
      if (table === 'tasks' && key === 'checklist') {
        if (value === null || value === undefined || value === '') {
          payload[key] = [];
        } else if (typeof value === 'string') {
          try {
            payload[key] = JSON.parse(value);
          } catch {
            payload[key] = value
              .split(/\n|,/)
              .map((item) => item.trim())
              .filter(Boolean);
          }
        }

        payload[key] = JSON.stringify(Array.isArray(payload[key]) ? payload[key] : payload[key] || []);
        continue;
      }

      if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
        payload[key] = JSON.stringify(value);
        continue;
      }

      if (Array.isArray(value)) {
        payload[key] = JSON.stringify(value);
        continue;
      }

      payload[key] = value;
    }

    return { safeKeys: Object.keys(payload), payload };
  }

  // list
  router.get('/', async (req, res) => {
    try {
      const colsList = await loadColumns();
      const filters = req.query || {};
      const whereClauses = [];
      const params = [];

      if (softDelete) {
        whereClauses.push(`${softDelete} IS NULL`);
      }

      if (userScoped && colsList.includes('user_id') && req.user?.id) {
        whereClauses.push(`user_id = $${params.length + 1}`);
        params.push(req.user.id);
      }

      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        if (key === 'search') {
          whereClauses.push(`title ILIKE $${params.length + 1}`);
          params.push(`%${String(value)}%`);
          return;
        }
        if (!colsList.includes(key)) return;

        if (key === 'is_favorite') {
          const normalized = String(value).toLowerCase();
          const boolValue = normalized === 'true' || normalized === '1' || normalized === 'yes';
          whereClauses.push(`"${key}" = $${params.length + 1}`);
          params.push(boolValue);
          return;
        }

        if (key === 'priority' || key === 'urgency') {
          whereClauses.push(`"${key}" = $${params.length + 1}`);
          params.push(Number(value));
          return;
        }

        whereClauses.push(`"${key}" = $${params.length + 1}`);
        params.push(value);
      });

      const orderColumn = colsList.includes('updated_at') ? 'updated_at' : (colsList.includes('created_at') ? 'created_at' : idCol);
      let q = `SELECT ${cols ? cols.join(',') : '*'} FROM ${table}`;
      if (whereClauses.length > 0) {
        q += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      q += ` ORDER BY ${orderColumn} DESC NULLS LAST LIMIT 100`;
      const result = await pool.query(q, params);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // get by id
  router.get('/:id', async (req, res) => {
    try {
      const colsList = await loadColumns();
      let q = `SELECT ${cols ? cols.join(',') : '*'} FROM ${table} WHERE ${idCol} = $1`;
      const params = [req.params.id];
      if (userScoped && colsList.includes('user_id') && req.user?.id) {
        q += ` AND user_id = $2`;
        params.push(req.user.id);
      }
      q += ' LIMIT 1';
      const result = await pool.query(q, params);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // create
  router.post('/', async (req, res) => {
    try {
      const { safeKeys, payload } = await normalizePayload(req.body || {}, req);
      if (safeKeys.length === 0) return res.status(400).json({ error: 'No fields provided' });
      const colsSql = safeKeys.join(', ');
      const params = safeKeys.map((_, i) => `$${i + 1}`);
      const q = `INSERT INTO ${table} (${colsSql}) VALUES (${params.join(',')}) RETURNING *`;
      const vals = safeKeys.map(k => payload[k]);
      const result = await pool.query(q, vals);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // update
  router.put('/:id', async (req, res) => {
    try {
      const { safeKeys, payload } = await normalizePayload(req.body || {}, req);
      if (safeKeys.length === 0) return res.status(400).json({ error: 'No fields provided' });
      const sets = safeKeys.map((k, i) => `${k} = $${i + 1}`);
      const vals = safeKeys.map(k => payload[k]);
      let q = `UPDATE ${table} SET ${sets.join(', ')} WHERE ${idCol} = $${vals.length + 1}`;
      const params = [...vals, req.params.id];
      const colsList = await loadColumns();
      if (userScoped && colsList.includes('user_id') && req.user?.id) {
        q += ` AND user_id = $${params.length + 1}`;
        params.push(req.user.id);
      }
      q += ' RETURNING *';
      const result = await pool.query(q, params);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // delete (soft delete if configured)
  router.delete('/:id', async (req, res) => {
    try {
      const colsList = await loadColumns();
      if (softDelete) {
        let q = `UPDATE ${table} SET ${softDelete} = NOW() WHERE ${idCol} = $1`;
        const params = [req.params.id];
        if (userScoped && colsList.includes('user_id') && req.user?.id) {
          q += ` AND user_id = $2`;
          params.push(req.user.id);
        }
        q += ' RETURNING *';
        const result = await pool.query(q, params);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
        return res.json(result.rows[0]);
      } else {
        let q = `DELETE FROM ${table} WHERE ${idCol} = $1`;
        const params = [req.params.id];
        if (userScoped && colsList.includes('user_id') && req.user?.id) {
          q += ` AND user_id = $2`;
          params.push(req.user.id);
        }
        q += ' RETURNING *';
        const result = await pool.query(q, params);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
        return res.json({ deleted: true });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createCrudRouter };

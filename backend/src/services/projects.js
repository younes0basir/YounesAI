const pool = require('../db');

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

async function listProjects(userId) {
  const result = await pool.query(
    `SELECT DISTINCT p.*
     FROM projects p
     LEFT JOIN project_memberships pm ON pm.project_id = p.id
     WHERE p.owner_id = $1 OR pm.user_id = $1
     ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
     LIMIT 200`,
    [userId]
  );
  return result.rows;
}

async function getProject(userId, projectId) {
  const result = await pool.query(
    `SELECT p.* FROM projects p
     LEFT JOIN project_memberships pm ON pm.project_id = p.id
     WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)
     LIMIT 1`,
    [projectId, userId]
  );
  return result.rows[0] || null;
}

async function createProject(userId, { name, description = null }) {
  const inserted = await pool.query(
    'INSERT INTO projects (owner_id, name, description) VALUES ($1, $2, $3) RETURNING *',
    [userId, String(name).trim(), description]
  );
  const project = inserted.rows[0];
  await pool.query(
    `INSERT INTO project_memberships (project_id, user_id, role, invited_by)
     VALUES ($1, $2, 'owner', $2)
     ON CONFLICT (project_id, user_id) DO NOTHING`,
    [project.id, userId]
  );
  return project;
}

async function updateProject(userId, projectId, data) {
  if (!(await isProjectOwnerOrMember(projectId, userId))) {
    return null;
  }
  const allowed = ['name', 'description', 'status'];
  const entries = Object.entries(data || {}).filter(
    ([k, v]) => allowed.includes(k) && v !== undefined
  );
  if (entries.length === 0) return null;
  const sets = entries.map(([k], i) => `"${k}" = $${i + 1}`);
  const vals = entries.map(([, v]) => v);
  const result = await pool.query(
    `UPDATE projects SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length + 1} RETURNING *`,
    [...vals, projectId]
  );
  return result.rows[0] || null;
}

async function deleteProject(userId, projectId) {
  if (!(await isProjectOwnerOrMember(projectId, userId))) {
    return false;
  }
  await pool.query('DELETE FROM project_memberships WHERE project_id = $1', [projectId]);
  await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
  return true;
}

module.exports = {
  isProjectOwnerOrMember,
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
};

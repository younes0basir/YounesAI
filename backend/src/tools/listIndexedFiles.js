const pool = require('../db');

async function listIndexedFiles(context, limit = 50) {
  const result = await pool.query(
    `SELECT name, path, extension, size_bytes, indexed_at
     FROM files
     WHERE user_id = $1 AND is_deleted = FALSE
     ORDER BY indexed_at DESC
     LIMIT $2`,
    [context.userId, limit]
  );
  return { success: true, files: result.rows };
}

module.exports = listIndexedFiles;

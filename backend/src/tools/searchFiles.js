const pool = require('../db');

function folderFilePrefix(folderPath) {
  if (!folderPath) return null;
  if (folderPath.startsWith('web://')) {
    return folderPath.replace('web://', '') + '/';
  }
  return folderPath.replace(/[\\/]$/, '') + '\\';
}

async function searchFiles(context, query) {
  const like = `%${query || ''}%`;
  const params = [context.userId, like];
  let folderSql = '';
  const prefix = folderFilePrefix(context.activeFolder?.folderPath);
  if (prefix) {
    folderSql = ` AND path ILIKE $${params.length + 1} ESCAPE ''`;
    params.push(prefix + '%');
  }
  const result = await pool.query(
    `SELECT id, name, path, extension, size_bytes, mime_type, indexed_at
     FROM files
     WHERE user_id = $1 AND is_deleted = FALSE AND (name ILIKE $2 OR path ILIKE $2)${folderSql}
     ORDER BY indexed_at DESC
     LIMIT 20`,
    params
  );
  return { success: true, files: result.rows };
}

module.exports = searchFiles;

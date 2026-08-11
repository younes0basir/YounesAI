/**
 * File Management Database Tools
 * Direct database access utility queries to avoid LLM hallucinations for administrative file stats.
 */
const pool = require('../db');
const fs = require('fs/promises');
const path = require('path');

function folderFilePrefix(folderPath) {
  if (!folderPath) return null;
  if (folderPath.startsWith('web://')) {
    return folderPath.replace('web://', '') + '/';
  }
  return folderPath.replace(/[\\/]$/, '') + '\\';
}

function folderFileFilter(context, startIdx) {
  const prefix = folderFilePrefix(context.activeFolder?.folderPath);
  if (!prefix) return { sql: '', params: [] };
  return {
    sql: ` AND file_path ILIKE $${startIdx} ESCAPE ''`,
    params: [prefix + '%'],
  };
}

/**
 * Get all monitored folders
 */
async function getIndexedFolders(context) {
  console.log('[FILE_TOOL_CALLED] getIndexedFolders()');
  const res = await pool.query(
    'SELECT id, folder_path, is_active, last_scan, created_at FROM indexed_folders WHERE user_id = $1 ORDER BY created_at DESC',
    [context.userId]
  );
  console.log(`[INDEXED_FOLDERS_FOUND] Count: ${res.rowCount}`);
  return { success: true, folders: res.rows };
}

/**
 * Get count of monitored folders
 */
async function getIndexedFolderCount(context) {
  console.log('[FILE_TOOL_CALLED] getIndexedFolderCount()');
  const res = await pool.query(
    'SELECT COUNT(*)::int as count FROM indexed_folders WHERE user_id = $1 AND is_active = TRUE',
    [context.userId]
  );
  const count = res.rows[0]?.count || 0;
  console.log(`[INDEXED_FOLDERS_FOUND] Count: ${count}`);
  return { success: true, count };
}

/**
 * Get all indexed files from document_embeddings
 */
async function getIndexedFiles(context) {
  console.log('[FILE_TOOL_CALLED] getIndexedFiles()');
  const ff = folderFileFilter(context, 2);
  const res = await pool.query(
    `SELECT DISTINCT file_path, file_type, MAX(created_at) as indexed_at
     FROM document_embeddings
     WHERE user_id = $1${ff.sql}
     GROUP BY file_path, file_type
     ORDER BY indexed_at DESC`,
    [context.userId, ...ff.params]
  );
  console.log(`[INDEXED_FILES_FOUND] Count: ${res.rowCount}`);
  return { success: true, files: res.rows };
}

/**
 * Get total document count (chunks) in document_embeddings
 */
async function getIndexedDocumentCount(context) {
  console.log('[FILE_TOOL_CALLED] getIndexedDocumentCount()');
  const ff = folderFileFilter(context, 2);
  const res = await pool.query(
    `SELECT COUNT(*)::int as count FROM document_embeddings WHERE user_id = $1${ff.sql}`,
    [context.userId, ...ff.params]
  );
  const count = res.rows[0]?.count || 0;
  console.log(`[INDEXED_FILES_FOUND] Chunks Count: ${count}`);
  return { success: true, count };
}

/**
 * Get recent files indexed
 */
async function getRecentIndexedFiles(context, limit = 5) {
  console.log('[FILE_TOOL_CALLED] getRecentIndexedFiles()');
  const ff = folderFileFilter(context, 3);
  const res = await pool.query(
    `SELECT DISTINCT file_path, MAX(created_at) as indexed_at
     FROM document_embeddings
     WHERE user_id = $1${ff.sql}
     GROUP BY file_path
     ORDER BY indexed_at DESC
     LIMIT $2`,
    [context.userId, limit, ...ff.params]
  );
  console.log(`[INDEXED_FILES_FOUND] Recent Count: ${res.rowCount}`);
  return { success: true, files: res.rows };
}

/**
 * Get detailed indexing statistics
 */
async function getFolderStatistics(context) {
  console.log('[FILE_TOOL_CALLED] getFolderStatistics()');
  const folderCountRes = await pool.query(
    'SELECT COUNT(*)::int as count FROM indexed_folders WHERE user_id = $1',
    [context.userId]
  );
  const ff = folderFileFilter(context, 2);
  const docCountRes = await pool.query(
    `SELECT COUNT(*)::int as count, COUNT(DISTINCT file_path)::int as files_count FROM document_embeddings WHERE user_id = $1${ff.sql}`,
    [context.userId, ...ff.params]
  );
  const typesRes = await pool.query(
    `SELECT file_type, COUNT(DISTINCT file_path)::int as count FROM document_embeddings WHERE user_id = $1${ff.sql} GROUP BY file_type`,
    [context.userId, ...ff.params]
  );

  const stats = {
    foldersCount: folderCountRes.rows[0]?.count || 0,
    chunksCount: docCountRes.rows[0]?.count || 0,
    filesCount: docCountRes.rows[0]?.files_count || 0,
    types: typesRes.rows
  };

  console.log(`[INDEXED_FOLDERS_FOUND] Folders: ${stats.foldersCount}, Files: ${stats.filesCount}`);
  return { success: true, statistics: stats };
}

/**
 * List folder contents (names and types only, no file reading)
 * Returns an array of objects with name, isDirectory, and extension
 */
async function listFolderContents(folderPath) {
  console.log('[FILE_TOOL_CALLED] listFolderContents()', folderPath);
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const contents = entries.map(entry => {
      const fullPath = path.join(folderPath, entry.name);
      const ext = entry.isFile() ? path.extname(entry.name).toLowerCase() : '';
      return {
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        extension: ext,
        path: fullPath
      };
    });
    console.log(`[FOLDER_CONTENTS] Found ${contents.length} items in ${folderPath}`);
    return { success: true, contents };
  } catch (error) {
    console.error(`[FOLDER_CONTENTS_ERROR] ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getIndexedFolders,
  getIndexedFiles,
  getIndexedFolderCount,
  getIndexedDocumentCount,
  getRecentIndexedFiles,
  getFolderStatistics,
  listFolderContents
};

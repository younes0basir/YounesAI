const chokidar = require('chokidar');
const path = require('path');
const pool = require('../db');
const { processDocument } = require('./documentProcessor');

const watchers = new Map();
const SUPPORTED_EXTENSIONS = new Set(['pdf', 'docx', 'txt', 'md', 'csv']);

async function indexFile(filePath, userId) {
  try {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    if (!SUPPORTED_EXTENSIONS.has(ext)) return;

    console.log(`[Watcher] Indexing file: ${filePath}`);

    // Register in files table
    const filename = path.basename(filePath);
    await pool.query(
      `INSERT INTO files (user_id, name, path, extension, size_bytes, indexed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [userId, filename, filePath, ext, null]
    ).catch(() => {});

    // Delete existing embeddings for this file
    await pool.query(
      'DELETE FROM document_embeddings WHERE user_id = $1 AND file_path = $2',
      [userId, filePath]
    ).catch(() => {});

    // Process using document understanding pipeline
    const result = await processDocument({ userId, filePath });
    if (result.success) {
      console.log(`[Watcher] Successfully indexed file: ${filePath}`);
    } else {
      console.error(`[Watcher] Failed to process ${filePath}: ${result.reason}`);
    }
  } catch (error) {
    console.error(`[Watcher] Error indexing file ${filePath}:`, error);
  }
}

async function unindexFile(filePath, userId) {
  try {
    console.log(`[Watcher] Unindexing file: ${filePath}`);
    await pool.query(
      'DELETE FROM document_embeddings WHERE user_id = $1 AND file_path = $2',
      [userId, filePath]
    ).catch(() => {});
    // Soft-delete in files table
    await pool.query(
      'UPDATE files SET is_deleted = TRUE WHERE user_id = $1 AND path = $2',
      [userId, filePath]
    ).catch(() => {});
  } catch (error) {
    console.error(`[Watcher] Error unindexing file ${filePath}:`, error);
  }
}

function watchFolder(folderPath, userId) {
  if (watchers.has(folderPath)) {
    console.log(`[Watcher] Folder already being watched: ${folderPath}`);
    return;
  }

  console.log(`[Watcher] Starting watch on: ${folderPath}`);

  const watcher = chokidar.watch(folderPath, {
    ignored: /(^|[\/\\])\.(?!$)/,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
  });

  watcher
    .on('add', async (filePath) => {
      console.log(`[Watcher] File added: ${filePath}`);
      await indexFile(filePath, userId);
    })
    .on('change', async (filePath) => {
      console.log(`[Watcher] File modified: ${filePath}`);
      await indexFile(filePath, userId);
    })
    .on('unlink', async (filePath) => {
      console.log(`[Watcher] File deleted: ${filePath}`);
      await unindexFile(filePath, userId);
    })
    .on('error', (error) => {
      console.error(`[Watcher] Error in watcher for ${folderPath}:`, error);
    });

  watchers.set(folderPath, watcher);
}

function unwatchFolder(folderPath) {
  const watcher = watchers.get(folderPath);
  if (watcher) {
    watcher.close().then(() => {
      console.log(`[Watcher] Stopped watching: ${folderPath}`);
      watchers.delete(folderPath);
    });
  }
}

async function initializeWatchers() {
  try {
    const result = await pool.query(
      'SELECT user_id, folder_path FROM indexed_folders WHERE is_active = TRUE'
    );
    for (const row of result.rows) {
      watchFolder(row.folder_path, row.user_id);
    }
  } catch (error) {
    console.error('[Watcher] Failed to initialize watchers:', error);
  }
}

module.exports = {
  watchFolder,
  unwatchFolder,
  initializeWatchers,
  indexFile,
};

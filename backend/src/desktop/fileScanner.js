const fs = require('fs/promises');
const path = require('path');
const fileReader = require('./fileReader');
const pool = require('../db');

const SUPPORTED_EXTENSIONS = new Set(['pdf', 'docx', 'txt', 'md', 'csv']);
const IGNORED_DIRS = new Set(['node_modules', '.git', '.cache', 'dist', 'build', '.next', '__pycache__', '.vscode', 'venv', '.venv']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function getFileInfo(filePath) {
  const stats = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  return {
    path: filePath,
    filename: path.basename(filePath),
    extension: ext,
    size_bytes: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
  };
}

function shouldIgnoreDir(dirName) {
  if (dirName.startsWith('.')) return true;
  return IGNORED_DIRS.has(dirName);
}

async function scanRecursive(folderPath) {
  const results = [];

  async function helper(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (shouldIgnoreDir(entry.name)) continue;
          await helper(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

          try {
            const stats = await fs.stat(fullPath);
            if (stats.size > MAX_FILE_SIZE) {
              console.log(`[fileScanner] Skipping ${fullPath}: ${(stats.size / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit`);
              continue;
            }
            results.push({
              path: fullPath,
              filename: entry.name,
              extension: ext,
              size_bytes: stats.size,
              createdAt: stats.birthtime,
              modifiedAt: stats.mtime,
            });
          } catch { /* skip files we can't stat */ }
        }
      }
    } catch (error) {
      console.error(`[fileScanner] Error scanning ${dir}:`, error.message);
    }
  }

  await helper(folderPath);
  return results;
}

async function registerFileInDb({ userId, filePath, filename, extension, sizeBytes }) {
  try {
    const result = await pool.query(
      `INSERT INTO files (user_id, name, path, extension, size_bytes, indexed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [userId, filename, filePath, extension, sizeBytes]
    );
    return result.rows[0]?.id || null;
  } catch (err) {
    console.error(`[fileScanner] DB insert error for ${filePath}:`, err.message);
    return null;
  }
}

async function scanAndIndex({ userId, folderPath }) {
  const files = await scanRecursive(folderPath);
  const folderWatcher = require('./folderWatcher');
  let indexed = 0;

  for (const file of files) {
    const fileId = await registerFileInDb({
      userId,
      filePath: file.path,
      filename: file.filename,
      extension: file.extension,
      sizeBytes: file.size_bytes,
    });
    if (fileId) {
      folderWatcher.indexFile(file.path, userId).catch(err => {
        console.error(`[fileScanner] Index error for ${file.path}:`, err.message);
      });
      indexed++;
    }
  }
  return indexed;
}

module.exports = {
  scanRecursive,
  getFileInfo,
  readFile: (filePath) => fileReader.readFile(filePath),
  registerFileInDb,
  scanAndIndex,
};

const pool = require('../db');
const fallbackManager = require('../agents/fallbackManager');

function filePathPrefix(folderPath) {
  if (folderPath.startsWith('web://')) {
    return folderPath.replace('web://', '') + '/';
  }
  return folderPath.replace(/[\\/]$/, '') + '\\';
}

function folderWhereClause(paramIdx, folderPath) {
  if (!folderPath) return { sql: '', params: [] };
  const prefix = filePathPrefix(folderPath);
  return {
    sql: ` AND file_path ILIKE $${paramIdx} ESCAPE ''`,
    params: [prefix + '%'],
  };
}

async function retrieveDocuments({ userId, query, limit = 5, folderPath }) {
  if (!userId) return [];
  const start = Date.now();
  let results = [];

  try {
    const trimmed = (query || '').trim();
    let paramIdx = 2;

    // Step 1: Fast ILIKE filter to find candidate file paths
    let candidatePaths = [];
    if (trimmed) {
      const like = `%${trimmed}%`;
      const fw = folderWhereClause(3, folderPath);
      const pathRes = await pool.query(
        `SELECT DISTINCT file_path FROM document_embeddings
         WHERE user_id = $1 AND (file_path ILIKE $2 OR content ILIKE $2)${fw.sql}
         LIMIT 50`,
        [userId, like, ...fw.params]
      );
      candidatePaths = pathRes.rows.map((r) => r.file_path);
    }

    // Step 2: If we have candidates, try vector search on the subset
    if (candidatePaths.length > 0) {
      const embResult = await fallbackManager.generateEmbedding(trimmed);
      if (embResult.success && embResult.embedding) {
        const vectorStr = `[${embResult.embedding.join(',')}]`;
        const placeholders = candidatePaths.map((_, i) => `$${i + 3}`).join(',');
        const offset = candidatePaths.length + 3;
        const fw = folderWhereClause(offset, folderPath);
        const res = await pool
          .query(
            `SELECT id, file_path, content, summary, entities, file_type,
                (1 - (embedding <=> $2::vector)) AS similarity
         FROM document_embeddings
         WHERE user_id = $1
           AND file_path IN (${placeholders})
           AND embedding IS NOT NULL${fw.sql}
         ORDER BY embedding <=> $2::vector
         LIMIT $${offset + (fw.params.length > 0 ? 1 : 0)}`,
            [userId, vectorStr, ...candidatePaths, ...fw.params, limit]
          )
          .catch(() => null);
        if (res?.rows?.length) {
          results = res.rows;
        }
      }
    }

    // Step 3: Fallback to plain ILIKE if vector search returned nothing
    if (!results.length && trimmed) {
      const like = `%${trimmed}%`;
      const fw = folderWhereClause(4, folderPath);
      const res = await pool.query(
        `SELECT id, file_path, content, summary, entities, file_type, 0.5 AS similarity
         FROM document_embeddings
         WHERE user_id = $1 AND (content ILIKE $2 OR file_path ILIKE $2 OR summary ILIKE $2)${fw.sql}
         ORDER BY created_at DESC
         LIMIT $3`,
        [userId, like, limit, ...fw.params]
      );
      results = res.rows;
    }

    // Step 4: If no query, return recent embeddings
    if (!trimmed && !results.length) {
      const fw = folderWhereClause(3, folderPath);
      const res = await pool.query(
        `SELECT id, file_path, content, summary, entities, file_type, 0 AS similarity
         FROM document_embeddings
         WHERE user_id = $1${fw.sql}
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit, ...fw.params]
      );
      results = res.rows;
    }

    // Log retrieval analytics
    await pool
      .query(
        `INSERT INTO retrieval_logs (user_id, query, source, result_count, latency_ms, had_results)
       VALUES ($1,$2,'documents',$3,$4,$5)`,
        [userId, query, results.length, Date.now() - start, results.length > 0]
      )
      .catch(() => {});

    return results;
  } catch (err) {
    console.error('[retrieveDocuments] Error:', err.message);
    return [];
  }
}

module.exports = { retrieveDocuments };

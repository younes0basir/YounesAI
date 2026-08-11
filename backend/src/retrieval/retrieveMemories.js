/**
 * Retrieve relevant memories from memory_embeddings using vector similarity.
 */
const pool = require('../db');
const fallbackManager = require('../agents/fallbackManager');

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.query
 * @param {number} [opts.limit=5]
 * @returns {Promise<Array>}
 */
async function retrieveMemories({ userId, query, limit = 5 }) {
  if (!userId || !query) return [];
  const start = Date.now();
  let results = [];

  try {
    // Try vector similarity search
    const embResult = await fallbackManager.generateEmbedding(query);
    if (embResult.success && embResult.embedding) {
      const vectorStr = `[${embResult.embedding.join(',')}]`;
      const res = await pool.query(
        `SELECT id, content, metadata, created_at,
                (1 - (embedding <=> $2::vector)) AS similarity
         FROM memory_embeddings
         WHERE user_id = $1 AND embedding IS NOT NULL
         ORDER BY embedding <=> $2::vector
         LIMIT $3`,
        [userId, vectorStr, limit]
      ).catch(() => null);
      if (res?.rows?.length) results = res.rows;
    }

    // Fallback: recency + keyword
    if (!results.length) {
      const like = `%${query}%`;
      const res = await pool.query(
        `SELECT id, content, metadata, created_at, 0.5 AS similarity
         FROM memory_embeddings
         WHERE user_id = $1 AND content ILIKE $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [userId, like, limit]
      );
      results = res.rows;
    }

    await pool.query(
      `INSERT INTO retrieval_logs (user_id, query, source, result_count, latency_ms, had_results)
       VALUES ($1,$2,'memories',$3,$4,$5)`,
      [userId, query, results.length, Date.now() - start, results.length > 0]
    ).catch(() => {});

    return results;
  } catch (err) {
    console.error('[retrieveMemories] Error:', err.message);
    return [];
  }
}

module.exports = { retrieveMemories };

const pool = require('../db');
const fallbackManager = require('../agents/fallbackManager');

function cosineSimilarity(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function retrieveMemory(context, query, topK = 5) {
  const embeddingResult = await fallbackManager.generateEmbedding(query);

  if (embeddingResult.success) {
    try {
      const result = await pool.query(
        `SELECT id, content, metadata, created_at, 1 - (embedding <=> $1::vector) AS similarity
         FROM memory_embeddings
         WHERE user_id = $2 AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        [`[${embeddingResult.embedding.join(',')}]`, context.userId, topK]
      );
      return { success: true, results: result.rows };
    } catch (err) {
      if (!err.message.includes('vector')) throw err;
    }
  }

  const allMemories = await pool.query(
    `SELECT id, content, embedding_json, metadata, created_at FROM memory_embeddings WHERE user_id = $1 AND embedding_json IS NOT NULL`,
    [context.userId]
  );

  const scored = allMemories.rows
    .map((row) => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata,
      created_at: row.created_at,
      similarity: embeddingResult.success
        ? cosineSimilarity(embeddingResult.embedding, row.embedding_json)
        : 0,
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  if (scored.length === 0) {
    const recent = await pool.query(
      `SELECT id, content, metadata, created_at FROM memory_embeddings WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [context.userId, topK]
    );
    return { success: true, results: recent.rows };
  }

  return { success: true, results: scored };
}

module.exports = retrieveMemory;

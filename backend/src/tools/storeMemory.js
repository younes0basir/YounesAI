const pool = require('../db');
const fallbackManager = require('../agents/fallbackManager');

async function storeMemory(context, text, metadata = {}) {
  if (!context.userId) throw new Error('userId required for memory storage');
  if (!text || text.trim().length === 0) throw new Error('Memory text cannot be empty');

  // Dedup: don't store identical content within 24h
  const existing = await pool.query(
    `SELECT id FROM memory_embeddings
     WHERE user_id = $1 AND content = $2 AND created_at > NOW() - INTERVAL '24 hours'
     LIMIT 1`,
    [context.userId, text.trim()]
  );
  if (existing.rowCount > 0) {
    return {
      success: true,
      message: 'Memory already stored (deduplicated)',
      id: existing.rows[0].id,
    };
  }

  const embeddingResult = await fallbackManager.generateEmbedding(text);
  const embeddingVector = embeddingResult.success ? embeddingResult.embedding : null;

  const result = await pool.query(
    `INSERT INTO memory_embeddings (user_id, content, embedding, embedding_json, metadata)
     VALUES ($1, $2, $3::vector, $4, $5)
     RETURNING id`,
    [
      context.userId,
      text.trim(),
      embeddingVector ? `[${embeddingVector.join(',')}]` : null,
      embeddingVector ? JSON.stringify(embeddingVector) : null,
      JSON.stringify({ ...metadata, conversation_id: context.conversationId }),
    ]
  );
  return { success: true, message: 'Memory stored with embedding', id: result.rows[0].id };
}

module.exports = storeMemory;

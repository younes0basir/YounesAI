const pool = require('../db');

async function linkEntity(context, { sourceType, sourceId, targetType, targetId, metadata = {} }) {
  if (!sourceType || !sourceId || !targetType || !targetId) {
    return { success: false, error: 'sourceType, sourceId, targetType, and targetId are required' };
  }

  const result = await pool.query(
    `INSERT INTO entity_links (user_id, source_type, source_id, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, source_type, source_id, target_type, target_id) DO UPDATE SET metadata = EXCLUDED.metadata
     RETURNING *`,
    [context.userId, sourceType, sourceId, targetType, targetId, JSON.stringify(metadata)]
  );

  if (targetType === 'image' && sourceType === 'event') {
    await pool.query(
      `UPDATE calendar_events SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
       WHERE id = $2 AND user_id = $3`,
      [JSON.stringify({ imageUrl: metadata.imageUrl || metadata.url }), sourceId, context.userId]
    );
  }

  return { success: true, link: result.rows[0] };
}

module.exports = linkEntity;

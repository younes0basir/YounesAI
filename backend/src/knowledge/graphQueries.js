/**
 * Knowledge Graph Queries
 * 
 * Traversal and retrieval over the entity_relationships table.
 * All queries are optimized for the indexed adjacency table structure.
 */
const pool = require('../db');

/**
 * Get all entities directly connected to a given entity (1-hop neighbors).
 * 
 * @param {string} entityId
 * @param {string} [entityType]  — optional filter on from_entity_type
 * @param {string} [userId]      — scope to user
 * @returns {Promise<Array>}
 */
async function getConnectedEntities(entityId, entityType, userId) {
  try {
    const params = [entityId];
    const conditions = ['(er.from_entity_id = $1 OR er.to_entity_id = $1)'];
    if (userId) { params.push(userId); conditions.push(`er.user_id = $${params.length}`); }

    const res = await pool.query(
      `SELECT
         er.from_entity_type, er.from_entity_id,
         er.relationship_type,
         er.to_entity_type, er.to_entity_id,
         er.metadata, er.weight, er.created_at
       FROM entity_relationships er
       WHERE ${conditions.join(' AND ')}
       ORDER BY er.weight DESC, er.created_at DESC
       LIMIT 50`,
      params
    );
    return res.rows;
  } catch (err) {
    console.error('[graphQueries] getConnectedEntities error:', err.message);
    return [];
  }
}

/**
 * Find all documents related to a specific entity (project, task, user).
 * 
 * @param {string} entityId
 * @param {string} [userId]
 * @returns {Promise<Array>} — document_embeddings rows
 */
async function findRelatedDocuments(entityId, userId) {
  try {
    // Find documents linked via entity_relationships
    const relRes = await pool.query(
      `SELECT to_entity_id AS doc_id
       FROM entity_relationships
       WHERE from_entity_id = $1 AND to_entity_type = 'document'
       UNION
       SELECT from_entity_id AS doc_id
       FROM entity_relationships
       WHERE to_entity_id = $1 AND from_entity_type = 'document'`,
      [entityId]
    );

    const docIds = relRes.rows.map(r => r.doc_id);
    if (docIds.length === 0) return [];

    const params = [docIds];
    let whereExtra = '';
    if (userId) { params.push(userId); whereExtra = ` AND user_id = $${params.length}`; }

    const res = await pool.query(
      `SELECT id, file_path, content, summary, entities, file_type, created_at
       FROM document_embeddings
       WHERE id = ANY($1)${whereExtra}
       ORDER BY created_at DESC`,
      params
    );
    return res.rows;
  } catch (err) {
    console.error('[graphQueries] findRelatedDocuments error:', err.message);
    return [];
  }
}

/**
 * Find all resources (tasks, events, files, places) linked to a project.
 * 
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<{ tasks: Array, events: Array, documents: Array }>}
 */
async function findProjectResources(projectId, userId) {
  try {
    const [tasks, events, documents] = await Promise.all([
      pool.query(
        `SELECT id, title, status, priority, due_at
         FROM tasks
         WHERE project_id = $1 AND user_id = $2 AND deleted_at IS NULL
         ORDER BY priority DESC, due_at ASC NULLS LAST
         LIMIT 20`,
        [projectId, userId]
      ).then(r => r.rows).catch(() => []),

      pool.query(
        `SELECT id, title, starts_at, ends_at
         FROM calendar_events
         WHERE user_id = $1 AND title ILIKE '%' || (
           SELECT name FROM projects WHERE id = $2
         ) || '%'
         ORDER BY starts_at ASC
         LIMIT 10`,
        [userId, projectId]
      ).then(r => r.rows).catch(() => []),

      findRelatedDocuments(projectId, userId),
    ]);

    return { tasks, events, documents };
  } catch (err) {
    console.error('[graphQueries] findProjectResources error:', err.message);
    return { tasks: [], events: [], documents: [] };
  }
}

/**
 * Build a summary graph for a user — entity counts and top connections.
 * 
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function buildUserGraph(userId) {
  try {
    const [entityCounts, topConnections, relationshipTypes] = await Promise.all([
      pool.query(
        `SELECT from_entity_type AS entity_type, COUNT(DISTINCT from_entity_id)::int AS count
         FROM entity_relationships
         WHERE user_id = $1
         GROUP BY from_entity_type
         ORDER BY count DESC`,
        [userId]
      ).then(r => r.rows).catch(() => []),

      pool.query(
        `SELECT from_entity_id, from_entity_type, COUNT(*)::int AS connections
         FROM entity_relationships
         WHERE user_id = $1
         GROUP BY from_entity_id, from_entity_type
         ORDER BY connections DESC
         LIMIT 10`,
        [userId]
      ).then(r => r.rows).catch(() => []),

      pool.query(
        `SELECT relationship_type, COUNT(*)::int AS count
         FROM entity_relationships
         WHERE user_id = $1
         GROUP BY relationship_type
         ORDER BY count DESC`,
        [userId]
      ).then(r => r.rows).catch(() => []),
    ]);

    return { entityCounts, topConnections, relationshipTypes };
  } catch (err) {
    console.error('[graphQueries] buildUserGraph error:', err.message);
    return { entityCounts: [], topConnections: [], relationshipTypes: [] };
  }
}

module.exports = {
  getConnectedEntities,
  findRelatedDocuments,
  findProjectResources,
  buildUserGraph,
};

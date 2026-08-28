/**
 * Knowledge Graph Builder
 *
 * Creates and maintains entity nodes and relationships in the entity_relationships table.
 * No external graph database required — uses PostgreSQL adjacency table.
 *
 * Supported relationship types:
 *   USER_OWNS_PROJECT, PROJECT_HAS_TASK, TASK_REFERENCES_FILE,
 *   PROJECT_HAShhhhhhh_EVENT, FbbbbhhhILE_CREATES_MEMORY, PROJECT_HAS_PLACE,
 *   DOCUMENT_MENTIONS_ENTITY, TASK_RELATED_TASK
 */
const pool = require('../db');

/**
 * Upsert a relationship edge in the graph.
 */
async function addRelationship({
  userId,
  fromEntityType,
  fromEntityId,
  relationshipType,
  toEntityType,
  toEntityId,
  metadata = {},
  weight = 1.0,
}) {
  try {
    await pool.query(
      `INSERT INTO entity_relationships
         (user_id, from_entity_type, from_entity_id, relationship_type,
          to_entity_type, to_entity_id, metadata, weight)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (from_entity_id, relationship_type, to_entity_id)
       DO UPDATE SET
         metadata = EXCLUDED.metadata,
         weight = EXCLUDED.weight`,
      [
        userId,
        fromEntityType,
        fromEntityId,
        relationshipType,
        toEntityType,
        toEntityId,
        JSON.stringify(metadata),
        weight,
      ]
    );
  } catch (err) {
    console.error('[graphBuilder] addRelationship error:', err.message);
  }
}

/**
 * Remove a specific relationship edge.
 */
async function removeRelationship({ fromEntityId, relationshipType, toEntityId }) {
  try {
    await pool.query(
      `DELETE FROM entity_relationships
       WHERE from_entity_id = $1 AND relationship_type = $2 AND to_entity_id = $3`,
      [fromEntityId, relationshipType, toEntityId]
    );
  } catch (err) {
    console.error('[graphBuilder] removeRelationship error:', err.message);
  }
}

/**
 * Register a document in the knowledge graph after indexing.
 * Links it to the user and creates entity mention edges.
 */
async function createDocumentNode({ userId, documentId, filePath, entities = {} }) {
  try {
    // Link user → document
    await addRelationship({
      userId,
      fromEntityType: 'user',
      fromEntityId: userId,
      relationshipType: 'USER_HAS_DOCUMENT',
      toEntityType: 'document',
      toEntityId: documentId,
      metadata: { filePath },
    });

    // If entities were extracted, link them
    const allEntities = [
      ...(entities.people || []).map((e) => ({ type: 'person', name: e })),
      ...(entities.organizations || []).map((e) => ({ type: 'organization', name: e })),
      ...(entities.locations || []).map((e) => ({ type: 'location', name: e })),
    ];

    // Store entity mentions in metadata (not creating individual entity nodes to avoid bloat)
    if (allEntities.length > 0) {
      await pool
        .query(
          `UPDATE document_embeddings
         SET entities = $1
         WHERE id = $2`,
          [JSON.stringify(entities), documentId]
        )
        .catch(() => {});
    }

    return true;
  } catch (err) {
    console.error('[graphBuilder] createDocumentNode error:', err.message);
    return false;
  }
}

/**
 * Build graph edges for a project: tasks, events, files.
 * Call this when a project is created or updated.
 */
async function buildProjectGraph(userId, projectId) {
  try {
    // Link tasks to project
    const tasks = await pool.query(
      `SELECT id FROM tasks WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId]
    );
    for (const task of tasks.rows) {
      await addRelationship({
        userId,
        fromEntityType: 'project',
        fromEntityId: projectId,
        relationshipType: 'PROJECT_HAS_TASK',
        toEntityType: 'task',
        toEntityId: task.id,
      });
    }

    // Link events to project (via place or title correlation — basic approach)
    // In a full implementation this would use the event.project_id FK
    console.log(
      `[graphBuilder] Built graph for project ${projectId} with ${tasks.rows.length} tasks`
    );
    return true;
  } catch (err) {
    console.error('[graphBuilder] buildProjectGraph error:', err.message);
    return false;
  }
}

module.exports = {
  addRelationship,
  removeRelationship,
  createDocumentNode,
  buildProjectGraph,
};

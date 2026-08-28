/**
 * @typedef {Object} EntityRef
 * @property {string} id
 * @property {string} type - task | event | project | file | image | memory
 * @property {string} [title]
 * @property {string} [updatedAt]
 * @property {Record<string, unknown>} [meta]
 */

/**
 * @typedef {Object} ConversationSessionState
 * @property {string} sessionId
 * @property {string} userId
 * @property {EntityRef|null} currentTask
 * @property {EntityRef|null} currentEvent
 * @property {EntityRef|null} currentProject
 * @property {EntityRef|null} currentImage
 * @property {EntityRef|null} currentFile
 * @property {EntityRef|null} currentMemory
 * @property {string|null} lastAgent
 * @property {string|null} lastTool
 * @property {Record<string, EntityRef>} activeEntities
 * @property {Record<string, unknown>} workingMemory
 */

/**
 * @typedef {Object} EntityBinding
 * @property {string} type
 * @property {string} id
 * @property {string} [title]
 * @property {'context'|'tool'|'inferred'} source
 */

/**
 * @typedef {Object} ResolvedContext
 * @property {string} resolvedMessage
 * @property {EntityBinding[]} bindings
 * @property {string[]} unresolved
 */

module.exports = {};

const crypto = require('crypto');
const pool = require('../db');

const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours idle
const cache = new Map();

function cacheKey(userId, sessionId) {
  return `${userId}:${sessionId}`;
}

function emptyState(userId, sessionId) {
  return {
    sessionId,
    userId,
    currentTask: null,
    currentEvent: null,
    currentProject: null,
    currentImage: null,
    currentFile: null,
    currentMemory: null,
    lastAgent: null,
    lastTool: null,
    activeEntities: {},
    workingMemory: {},
    updatedAt: Date.now(),
  };
}

function entityRef(type, id, title, meta = {}) {
  if (!id) return null;
  return {
    type,
    id: String(id),
    title: title || null,
    updatedAt: new Date().toISOString(),
    meta,
  };
}

function touch(state) {
  state.updatedAt = Date.now();
  return state;
}

async function loadFromDb(userId, sessionId) {
  const result = await pool.query(
    `SELECT entities FROM conversations
     WHERE user_id = $1 AND role = 'assistant' AND entities IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId]
  );

  for (const row of result.rows) {
    const entities = row.entities;
    if (!entities || typeof entities !== 'object') continue;
    if (entities.sessionId === sessionId && entities.activeEntities) {
      const state = emptyState(userId, sessionId);
      state.activeEntities = entities.activeEntities || {};
      for (const [type, ref] of Object.entries(state.activeEntities)) {
        if (type === 'task') state.currentTask = ref;
        if (type === 'event') state.currentEvent = ref;
        if (type === 'project') state.currentProject = ref;
        if (type === 'image') state.currentImage = ref;
        if (type === 'file') state.currentFile = ref;
        if (type === 'memory') state.currentMemory = ref;
      }
      state.lastAgent = entities.lastAgent || null;
      state.lastTool = entities.lastTool || null;
      state.workingMemory = entities.workingMemory || {};
      return touch(state);
    }
  }
  return null;
}

async function load(userId, sessionId) {
  if (!userId) return emptyState('anonymous', sessionId || crypto.randomUUID());
  const sid = sessionId || crypto.randomUUID();
  const key = cacheKey(userId, sid);

  const cached = cache.get(key);
  if (cached && Date.now() - cached.updatedAt < TTL_MS) {
    return touch(cached);
  }

  let state = null;
  try {
    state = await loadFromDb(userId, sid);
  } catch (err) {
    console.warn('[ConversationContext] DB load failed:', err.message);
  }

  if (!state) state = emptyState(userId, sid);
  cache.set(key, state);
  return state;
}

function save(userId, sessionId, state) {
  if (!userId || !sessionId) return;
  cache.set(cacheKey(userId, sessionId), touch({ ...state }));
}

function registerEntity(state, type, id, title, meta = {}) {
  const ref = entityRef(type, id, title, meta);
  if (!ref) return state;

  state.activeEntities[type] = ref;
  if (type === 'task') state.currentTask = ref;
  if (type === 'event') state.currentEvent = ref;
  if (type === 'project') state.currentProject = ref;
  if (type === 'image') state.currentImage = ref;
  if (type === 'file') state.currentFile = ref;
  if (type === 'memory') state.currentMemory = ref;

  state.workingMemory.lastCreatedAt = ref.updatedAt;
  state.workingMemory.lastEntityType = type;
  return touch(state);
}

function setLastAgent(state, agent, tool = null) {
  state.lastAgent = agent || null;
  state.lastTool = tool || null;
  return touch(state);
}

function toPersistedPayload(state, extras = {}) {
  const attachments = extras.attachments || [];
  // Base64 PNG for 768x1344 is ~2-4MB (base64 ~2.7-5.5M chars). Previous 50k cap broke every
  // image and caused Chat to stay on "Loading image…" forever. Cap at 8MB to stay within
  // JSONB/row limits while preserving valid data URLs.
  const IMAGE_URL_CAP = 8_000_000;
  const cappedAttachments = attachments.map((a) => {
    if (a.type === 'image' && a.url && a.url.length > IMAGE_URL_CAP) {
      return { ...a, url: a.url.slice(0, IMAGE_URL_CAP), truncated: true };
    }
    return a;
  });

  return {
    sessionId: state.sessionId,
    activeEntities: state.activeEntities,
    lastAgent: state.lastAgent,
    lastTool: state.lastTool,
    workingMemory: state.workingMemory,
    attachments: cappedAttachments,
    steps: extras.steps || [],
  };
}

function pruneCache() {
  const now = Date.now();
  for (const [key, state] of cache.entries()) {
    if (now - state.updatedAt > TTL_MS) cache.delete(key);
  }
}

setInterval(pruneCache, 15 * 60 * 1000).unref();

module.exports = {
  load,
  save,
  registerEntity,
  setLastAgent,
  toPersistedPayload,
  emptyState,
  entityRef,
};

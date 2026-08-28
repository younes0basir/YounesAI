const tools = require('../tools');

const PRONOUN_PATTERN =
  /\b(it|that|this|the previous one|the last one|previous|last one|the meeting|the task|the project|the image|the file|that task|that meeting|that project|that image|that file|the report|yesterday's report)\b/i;

const TYPE_HINTS = {
  meeting: 'event',
  event: 'event',
  calendar: 'event',
  task: 'task',
  todo: 'task',
  reminder: 'task',
  project: 'project',
  image: 'image',
  logo: 'image',
  poster: 'image',
  file: 'file',
  document: 'file',
  report: 'file',
  pdf: 'file',
};

function detectReferenceIntent(message) {
  return PRONOUN_PATTERN.test(message);
}

function inferPreferredType(message) {
  const lower = message.toLowerCase();
  for (const [hint, type] of Object.entries(TYPE_HINTS)) {
    if (lower.includes(hint)) return type;
  }
  return null;
}

function pickFromContext(conversationContext, preferredType) {
  const bindings = [];
  if (!conversationContext) return bindings;

  const { activeEntities, currentEvent, currentTask, currentProject, currentImage, currentFile } =
    conversationContext;

  const tryAdd = (ref, type) => {
    if (ref?.id) {
      bindings.push({ type, id: ref.id, title: ref.title, source: 'context' });
    }
  };

  if (preferredType) {
    tryAdd(activeEntities[preferredType], preferredType);
    if (bindings.length) return bindings;
  }

  // Default "it" → most recently touched entity
  const lastType = conversationContext.workingMemory?.lastEntityType;
  if (lastType && activeEntities[lastType]) {
    tryAdd(activeEntities[lastType], lastType);
    if (bindings.length) return bindings;
  }

  tryAdd(currentEvent, 'event');
  if (bindings.length === 1 && !preferredType) return bindings;
  tryAdd(currentTask, 'task');
  tryAdd(currentProject, 'project');
  tryAdd(currentImage, 'image');
  tryAdd(currentFile, 'file');

  return bindings.slice(0, 1);
}

async function resolveViaTools(context, preferredType) {
  const bindings = [];
  try {
    if (preferredType === 'event' || !preferredType) {
      const events = await tools.listEvents(context, { limit: 3 });
      const latest = events?.events?.[0];
      if (latest?.id) {
        bindings.push({ type: 'event', id: latest.id, title: latest.title, source: 'tool' });
      }
    }
    if (bindings.length === 0 && (preferredType === 'task' || !preferredType)) {
      const tasks = await tools.listTasks(context, { limit: 3 });
      const latest = tasks?.tasks?.[0];
      if (latest?.id) {
        bindings.push({ type: 'task', id: latest.id, title: latest.title, source: 'tool' });
      }
    }
  } catch (err) {
    console.warn('[EntityResolver] tool lookup failed:', err.message);
  }
  return bindings.slice(0, 1);
}

function enrichMessage(message, bindings) {
  if (!bindings.length) return message;
  const hints = bindings
    .map((b) => `[resolved ${b.type} id=${b.id}${b.title ? ` title="${b.title}"` : ''}]`)
    .join(' ');
  return `${message}\n\n${hints}`;
}

async function resolve(message, conversationContext, requestContext = {}) {
  if (!detectReferenceIntent(message)) {
    return {
      resolvedMessage: message,
      bindings: [],
      unresolved: [],
    };
  }

  const preferredType = inferPreferredType(message);
  let bindings = pickFromContext(conversationContext, preferredType);

  if (bindings.length === 0) {
    bindings = await resolveViaTools(requestContext, preferredType);
  }

  const unresolved = bindings.length === 0 ? ['Could not resolve referenced entity'] : [];

  const resolvedParameters = {};
  for (const b of bindings) {
    if (b.type === 'event') resolvedParameters.eventId = b.id;
    if (b.type === 'task') resolvedParameters.taskId = b.id;
    if (b.type === 'project') resolvedParameters.projectId = b.id;
    if (b.type === 'file') resolvedParameters.fileId = b.id;
    if (b.type === 'image') resolvedParameters.imageId = b.id;
  }

  return {
    resolvedMessage: enrichMessage(message, bindings),
    bindings,
    unresolved,
    resolvedParameters,
  };
}

module.exports = {
  resolve,
  detectReferenceIntent,
  inferPreferredType,
};

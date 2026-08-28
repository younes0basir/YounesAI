const ConversationContext = require('./ConversationContext');

function extractEntityFromResult(agentName, result) {
  const entities = [];
  const tool = result.toolResult;

  if (agentName === 'task') {
    const task = tool?.task || tool;
    if (task?.id) entities.push({ type: 'task', id: task.id, title: task.title });
    else {
      const idMatch = result.content?.match(/\(id:\s*([0-9a-f-]{36})\)/i);
      if (idMatch) entities.push({ type: 'task', id: idMatch[1], title: null });
    }
  }

  if (agentName === 'event') {
    const event = tool?.event || tool;
    if (event?.id) entities.push({ type: 'event', id: event.id, title: event.title });
    else {
      const idMatch = result.content?.match(/\(id:\s*([0-9a-f-]{36})\)/i);
      if (idMatch) entities.push({ type: 'event', id: idMatch[1], title: null });
    }
  }

  if (agentName === 'project') {
    const project = tool?.project || tool;
    if (project?.id)
      entities.push({ type: 'project', id: project.id, title: project.name || project.title });
  }

  if (agentName === 'file' && tool?.files?.[0]) {
    const f = tool.files[0];
    entities.push({ type: 'file', id: f.id || f.path, title: f.name || f.path });
  }

  if (agentName === 'memory' && result.content) {
    entities.push({
      type: 'memory',
      id: `mem-${Date.now()}`,
      title: String(result.content).slice(0, 80),
    });
  }

  if (agentName === 'image' && result.image) {
    entities.push({
      type: 'image',
      id: `img-${Date.now()}`,
      title: result.metadata?.prompt || 'generated image',
      meta: { imageData: result.image },
    });
  }

  return entities;
}

function applyResults(sessionState, agentResults) {
  let state = { ...sessionState };

  for (const result of agentResults) {
    if (!result.success) continue;
    ConversationContext.setLastAgent(state, result.agent, result.action || null);

    const extracted = extractEntityFromResult(result.agent, result);
    for (const e of extracted) {
      state = ConversationContext.registerEntity(state, e.type, e.id, e.title, e.meta || {});
    }
  }

  return state;
}

module.exports = {
  extractEntityFromResult,
  applyResults,
};

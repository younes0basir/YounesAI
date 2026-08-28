const SUCCESS_LABELS = {
  task: 'Task',
  event: 'Meeting',
  project: 'Project',
  image: 'Image',
  file: 'File',
  memory: 'Memory',
  email: 'Email',
  place: 'Place',
  desktop: 'Desktop',
  general: 'Response',
  gemma: 'Plan',
};

function summarizeStep(result) {
  const label = SUCCESS_LABELS[result.agent] || result.agent;
  if (!result.success) {
    return {
      agent: result.agent,
      success: false,
      summary: `✗ ${label} failed: ${result.error || 'unknown error'}`,
    };
  }

  const action = result.action || '';
  if (action === 'create' || result.content?.toLowerCase().includes('created')) {
    return { agent: result.agent, success: true, summary: `✓ ${label} created` };
  }
  if (action === 'update' || result.content?.toLowerCase().includes('updated')) {
    return { agent: result.agent, success: true, summary: `✓ ${label} updated` };
  }
  if (action === 'delete') {
    return { agent: result.agent, success: true, summary: `✓ ${label} deleted` };
  }
  if (action === 'attach' || result.content?.toLowerCase().includes('attached')) {
    return { agent: result.agent, success: true, summary: `✓ ${label} attached` };
  }
  if (action === 'invite' || result.content?.toLowerCase().includes('invited')) {
    return { agent: result.agent, success: true, summary: `✓ Guest invited` };
  }
  if (result.agent === 'memory' && result.content?.toLowerCase().includes('remember')) {
    return { agent: result.agent, success: true, summary: `✓ Stored in memory` };
  }
  if (result.agent === 'image') {
    return { agent: result.agent, success: true, summary: `✓ Image generated` };
  }

  const short = String(result.content || `${label} completed`)
    .split('\n')[0]
    .slice(0, 120);
  return { agent: result.agent, success: true, summary: `✓ ${short}` };
}

function aggregate(agentResults) {
  const steps = agentResults.map(summarizeStep);
  const successful = steps.filter((s) => s.success);

  if (steps.length <= 1) {
    return { steps, response: null, useChecklist: false };
  }

  const checklist = steps.map((s) => s.summary).join('\n');
  return {
    steps,
    response: checklist,
    useChecklist: successful.length > 0,
  };
}

function collectAttachments(agentResults) {
  const attachments = [];
  for (const r of agentResults) {
    if (r.success && r.image) {
      attachments.push({ type: 'image', url: r.image, agent: r.agent });
    }
  }
  return attachments;
}

module.exports = {
  aggregate,
  collectAttachments,
  summarizeStep,
};

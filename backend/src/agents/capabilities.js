/**
 * Agent capability registry — consumed by orchestrator planner.
 */
const CAPABILITIES = {
  task: { actions: ['create', 'update', 'delete', 'list', 'attach'] },
  event: { actions: ['create', 'update', 'delete', 'list', 'invite', 'attach'] },
  project: { actions: ['create', 'update', 'delete', 'list'] },
  image: { actions: ['generate', 'edit', 'attach'] },
  file: { actions: ['search', 'summarize', 'attach', 'getIndexedFolders', 'getIndexedFiles'] },
  memory: { actions: ['store', 'retrieve', 'search'] },
  email: { actions: ['list', 'classify', 'archive', 'summarize', 'create_task'] },
  place: { actions: ['search'] },
  desktop: { actions: ['search', 'scan', 'open', 'read', 'list_folder', 'folders', 'list_files'] },
  general: { actions: ['chat'] },
  gemma: { actions: ['plan', 'list', 'chat'] },
};

function formatCapabilitiesForPrompt() {
  return Object.entries(CAPABILITIES)
    .map(([agent, { actions }]) => `- ${agent}: ${actions.join(', ')}`)
    .join('\n');
}

module.exports.formatCapabilitiesForPrompt = formatCapabilitiesForPrompt;
module.exports.CAPABILITIES = CAPABILITIES;

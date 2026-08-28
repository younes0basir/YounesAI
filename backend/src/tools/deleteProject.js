const projectService = require('../services/projects');

async function deleteProject(context, projectId) {
  const ok = await projectService.deleteProject(context.userId, projectId);
  if (!ok) return { success: false, error: 'Project not found' };
  return { success: true };
}

module.exports = deleteProject;

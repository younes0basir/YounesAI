const projectService = require('../services/projects');

async function getProject(context, projectId) {
  const project = await projectService.getProject(context.userId, projectId);
  if (!project) return { success: false, error: 'Project not found' };
  return { success: true, project };
}

module.exports = getProject;

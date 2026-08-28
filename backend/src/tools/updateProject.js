const projectService = require('../services/projects');

async function updateProject(context, projectId, data) {
  const project = await projectService.updateProject(context.userId, projectId, data);
  if (!project) return { success: false, error: 'Project not found or no valid fields' };
  return { success: true, project };
}

module.exports = updateProject;

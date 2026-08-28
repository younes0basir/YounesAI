const projectService = require('../services/projects');

async function createProject(context, data) {
  if (!data?.name) return { success: false, error: 'Project name is required' };
  const project = await projectService.createProject(context.userId, data);
  return { success: true, project };
}

module.exports = createProject;

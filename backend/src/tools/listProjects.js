const projectService = require('../services/projects');

async function listProjects(context) {
  const projects = await projectService.listProjects(context.userId);
  return { success: true, projects };
}

module.exports = listProjects;

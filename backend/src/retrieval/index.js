/**
 * Shared Retrieval Layer — unified entry point for all agents.
 *
 * Usage:
 *   const retrieval = require('../retrieval');
 *   const docs = await retrieval.retrieveDocuments({ userId, query });
 *   const { evidence } = await retrieval.agenticRetrieve({ userId, query });
 */

const { retrieveDocuments } = require('./retrieveDocuments');
const { retrieveMemories } = require('./retrieveMemories');
const { retrieveConversations } = require('./retrieveConversations');
const { retrieveTasks } = require('./retrieveTasks');
const { retrieveProjects } = require('./retrieveProjects');
const { retrieveEvents } = require('./retrieveEvents');
const { agenticRetrieve, buildEvidenceContext, planRetrieval } = require('./agenticRetrieval');

module.exports = {
  // Individual retrievers
  retrieveDocuments,
  retrieveMemories,
  retrieveConversations,
  retrieveTasks,
  retrieveProjects,
  retrieveEvents,

  // Agentic multi-step retrieval
  agenticRetrieve,
  buildEvidenceContext,
  planRetrieval,
};

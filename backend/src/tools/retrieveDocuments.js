const { retrieveDocuments } = require('../retrieval/retrieveDocuments');

async function retrieveDocumentsTool(context, query, options = {}) {
  return retrieveDocuments({
    userId: context.userId,
    query: query || context.message,
    limit: options.limit || 5,
    folderPath: options.folderPath || context.activeFolder?.folderPath,
  });
}

module.exports = retrieveDocumentsTool;

/**
 * Agentic Retrieval Engine
 * 
 * Implements multi-step retrieval:
 * 1. Plan  — LLM classifies which sources are needed for the query
 * 2. Retrieve — parallel fetch from identified sources
 * 3. Merge — deduplicate, rank by relevance, trim to budget
 * 4. Answer — return merged evidence + source attribution
 * 
 * Inspired by NVIDIA RAG Blueprint agentic retrieval patterns.
 */
const fallbackManager = require('../agents/fallbackManager');
const { retrieveDocuments }    = require('./retrieveDocuments');
const { retrieveMemories }     = require('./retrieveMemories');
const { retrieveConversations }= require('./retrieveConversations');
const { retrieveTasks }        = require('./retrieveTasks');
const { retrieveProjects }     = require('./retrieveProjects');
const { retrieveEvents }       = require('./retrieveEvents');
const pool = require('../db');

const RETRIEVAL_SOURCES = {
  documents:     retrieveDocuments,
  memories:      retrieveMemories,
  conversations: retrieveConversations,
  tasks:         retrieveTasks,
  projects:      retrieveProjects,
  events:        retrieveEvents,
};

const PLANNING_PROMPT = `You are a retrieval planner for a multi-source AI assistant.

Given a user query, decide which data sources are relevant to fetch.
Available sources: documents, memories, conversations, tasks, projects, events

Rules:
- "documents" → local files, PDFs, invoices, contracts, notes
- "memories" → personal facts the user has stored
- "conversations" → past chat history
- "tasks" → todos, deadlines, action items
- "projects" → project workspaces, team collaboration
- "events" → calendar events, meetings, schedules
- Always include at most 3 sources for efficiency
- For general chat/greetings, return empty sources array

Respond ONLY with valid JSON:
{ "sources": ["source1", "source2"], "reasoning": "why these sources" }`;

/**
 * Plan which retrieval sources are needed.
 * @param {string} query
 * @returns {Promise<string[]>} — array of source names
 */
async function planRetrieval(query) {
  try {
    const result = await fallbackManager.generateText('general', [
      { role: 'system', content: PLANNING_PROMPT },
      { role: 'user', content: `Query: "${query}"` },
    ], { temperature: 0.1, maxTokens: 200 });

    if (!result.success) return ['memories', 'tasks'];

    const m = result.content.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      const valid = (parsed.sources || []).filter(s => RETRIEVAL_SOURCES[s]);
      return valid.length > 0 ? valid : ['memories', 'tasks'];
    }
  } catch (e) {
    console.error('[agenticRetrieval] Plan error:', e.message);
  }
  return ['memories', 'tasks'];
}

/**
 * Main agentic retrieval function.
 * 
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.query
 * @param {string[]} [opts.forceSources]  — skip planning and use these sources
 * @param {number}   [opts.limitPerSource=5]
 * @returns {Promise<{ evidence: Array, sources: string[], stats: object }>}
 */
async function agenticRetrieve({ userId, query, forceSources, limitPerSource = 5 }) {
  const start = Date.now();

  // Step 1: Plan
  const sources = forceSources || await planRetrieval(query);

  // Step 2: Parallel fetch from all planned sources
  const fetchResults = await Promise.all(
    sources.map(async (source) => {
      const fn = RETRIEVAL_SOURCES[source];
      if (!fn) return { source, items: [] };
      const items = await fn({ userId, query, limit: limitPerSource });
      return { source, items: items || [] };
    })
  );

  // Step 3: Merge and rank evidence
  const evidence = [];
  for (const { source, items } of fetchResults) {
    for (const item of items) {
      evidence.push({
        source,
        id: item.id,
        text: item.content || item.title || item.name || '',
        summary: item.summary || null,
        metadata: {
          filePath: item.file_path,
          status: item.status,
          priority: item.priority,
          dueAt: item.due_at,
          startsAt: item.starts_at,
          similarity: item.similarity || 0,
          entities: item.entities || null,
          fileType: item.file_type || null,
        },
      });
    }
  }

  // Sort by similarity score (descending), truncate
  evidence.sort((a, b) => (b.metadata.similarity || 0) - (a.metadata.similarity || 0));
  const topEvidence = evidence.slice(0, 15);

  const stats = {
    totalRetrieved: evidence.length,
    sourcesQueried: sources,
    latencyMs: Date.now() - start,
    evidenceServed: topEvidence.length,
  };

  return { evidence: topEvidence, sources, stats };
}

/**
 * Build a grounded context string from agentic retrieval evidence.
 * Injects into any agent's system prompt for grounded generation.
 * 
 * @param {Array} evidence
 * @returns {string}
 */
function buildEvidenceContext(evidence) {
  if (!evidence || evidence.length === 0) return '(no retrieved context available)';

  const grouped = {};
  for (const item of evidence) {
    if (!grouped[item.source]) grouped[item.source] = [];
    grouped[item.source].push(item);
  }

  const parts = Object.entries(grouped).map(([source, items]) => {
    const lines = items.map((item, i) => {
      const label = item.metadata.filePath
        ? `[${i + 1}] File: ${item.metadata.filePath}`
        : `[${i + 1}] ${source.charAt(0).toUpperCase() + source.slice(1)}`;
      const text = (item.summary || item.text || '').slice(0, 300);
      return `${label}\n${text}`;
    });
    return `## ${source.toUpperCase()} (${items.length} results)\n${lines.join('\n\n')}`;
  });

  return parts.join('\n\n---\n\n');
}

module.exports = { agenticRetrieve, buildEvidenceContext, planRetrieval };

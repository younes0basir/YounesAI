const crypto = require('crypto');
const path = require('path');
const pool = require('../db');
const { retrieveDocuments } = require('../retrieval/retrieveDocuments');
const { retrieveConversations } = require('../retrieval/retrieveConversations');

/**
 * Build a rich context object before every agent request.
 * Pre-fetches user identity, recent memories, active tasks, and upcoming events
 * so agents can reason with full situational awareness.
 */
async function buildContext(req) {
  const userId = req.user?.id || null;

  // Parallel DB fetches — fail gracefully on each
  const [userRow, recentMemories, activeTasks, upcomingEvents] = await Promise.all([
    userId
      ? pool
          .query('SELECT display_name, email FROM users WHERE id = $1', [userId])
          .then((r) => r.rows[0] || null)
          .catch(() => null)
      : Promise.resolve(null),

    userId
      ? pool
          .query(
            `SELECT content, metadata, created_at
           FROM memory_embeddings
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 5`,
            [userId]
          )
          .then((r) => r.rows)
          .catch(() => [])
      : Promise.resolve([]),

    userId
      ? pool
          .query(
            `SELECT id, title, status, priority, due_at
           FROM tasks
           WHERE user_id = $1
             AND status NOT IN ('done', 'cancelled', 'archived')
             AND deleted_at IS NULL
           ORDER BY priority DESC, due_at ASC NULLS LAST
           LIMIT 10`,
            [userId]
          )
          .then((r) => r.rows)
          .catch(() => [])
      : Promise.resolve([]),

    userId
      ? pool
          .query(
            `SELECT id, title, starts_at, ends_at
           FROM calendar_events
           WHERE user_id = $1
             AND starts_at >= NOW()
             AND starts_at <= NOW() + INTERVAL '7 days'
           ORDER BY starts_at ASC
           LIMIT 5`,
            [userId]
          )
          .then((r) => r.rows)
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  // Look up selected folder if folderId provided
  let activeFolder = null;
  if (userId && req.body?.folderId) {
    const fRes = await pool
      .query('SELECT id, folder_path FROM indexed_folders WHERE id = $1 AND user_id = $2', [
        req.body.folderId,
        userId,
      ])
      .catch(() => ({ rows: [] }));
    if (fRes.rows.length > 0) {
      activeFolder = { id: fRes.rows[0].id, folderPath: fRes.rows[0].folder_path };
    }
  }

  // Parallel: fetch conversation history and relevant documents
  const [recentConversations, relevantDocuments] = await Promise.all([
    userId ? retrieveConversations({ userId, limit: 5 }).catch(() => []) : Promise.resolve([]),

    userId && req.body?.message
      ? retrieveDocuments({
          userId,
          query: req.body.message,
          limit: 5,
          folderPath: activeFolder?.folderPath,
        }).catch(() => [])
      : Promise.resolve([]),
  ]);

  return {
    userId,
    email: req.user?.email || userRow?.email || null,
    name: userRow?.display_name || null,
    conversationId: req.body?.conversationId || crypto.randomUUID(),
    requestId: req.body?.requestId || crypto.randomUUID(),
    message: req.body?.message || '',
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent') || '',
    // Rich context injected for agents
    memories: recentMemories,
    activeTasks,
    upcomingEvents,
    recentConversations,
    relevantDocuments,
    activeFolder,
  };
}

/**
 * Format the rich context into a compact string for injection into system prompts.
 * Keeps the prompt concise to avoid burning tokens.
 */
function buildSystemPromptContext(context) {
  const parts = [];

  if (context.name || context.email) {
    parts.push(`User: ${context.name || 'unknown'} (${context.email || 'no email'})`);
  }

  if (context.activeTasks?.length > 0) {
    const taskLines = context.activeTasks
      .slice(0, 5)
      .map(
        (t) =>
          `  - [id=${t.id}] ${t.title} [${t.status}] priority=${t.priority}${t.due_at ? ` due=${new Date(t.due_at).toISOString().split('T')[0]}` : ''}`
      )
      .join('\n');
    parts.push(`Active Tasks (${context.activeTasks.length} total):\n${taskLines}`);
  }

  if (context.upcomingEvents?.length > 0) {
    const eventLines = context.upcomingEvents
      .map((e) => `  - [id=${e.id}] ${e.title} at ${new Date(e.starts_at).toISOString()}`)
      .join('\n');
    parts.push(`Upcoming Events (next 7 days):\n${eventLines}`);
  }

  if (context.memories?.length > 0) {
    const memLines = context.memories
      .slice(0, 3)
      .map((m) => `  - ${m.content}`)
      .join('\n');
    parts.push(`Recent Memories:\n${memLines}`);
  }

  if (context.recentConversations?.length > 0) {
    const convLines = context.recentConversations
      .slice(0, 3)
      .map((c) => `  [${c.role}] ${String(c.content || '').slice(0, 120)}`)
      .join('\n');
    parts.push(`Recent Conversations:\n${convLines}`);
  }

  if (context.parsedParameters?.dueAt) {
    parts.push(
      `Pre-parsed date: ${context.parsedParameters.dueAt} (use this as the due date for tasks)`
    );
  }
  if (context.parsedParameters?.startsAt) {
    parts.push(
      `Pre-parsed start time: ${context.parsedParameters.startsAt} (use this as starts_at for events, ends_at = +1 hour)`
    );
  }

  if (context.activeFolder) {
    const name =
      context.activeFolder.folderPath.split(/[\\/]/).pop() || context.activeFolder.folderPath;
    parts.push(`Active Folder Scope: "${name}" — only search documents inside this folder.`);
  }

  if (context.relevantDocuments?.length > 0) {
    const docLines = context.relevantDocuments
      .map((d) => {
        const name = d.file_path ? require('path').basename(d.file_path) : 'Document';
        const snippet = (d.summary || d.content || '').slice(0, 300);
        return `  - ${name} [${d.file_type || 'unknown'}] (score: ${typeof d.similarity === 'number' ? d.similarity.toFixed(2) : 'N/A'}): ${snippet}`;
      })
      .join('\n');
    parts.push(`Relevant Documents:\n${docLines}`);
  }

  if (context.conversationSession?.activeEntities) {
    const refs = Object.entries(context.conversationSession.activeEntities)
      .map(([type, ref]) => `  - ${type}: [id=${ref.id}] ${ref.title || ''}`)
      .join('\n');
    if (refs) parts.push(`Active session entities (use for "it/that" references):\n${refs}`);
  }

  if (context.resolvedEntities?.length > 0) {
    const bound = context.resolvedEntities
      .map((b) => `  - ${b.type} id=${b.id} (${b.source})`)
      .join('\n');
    parts.push(`Resolved references in this turn:\n${bound}`);
  }

  if (context.executionResults && Object.keys(context.executionResults).length > 0) {
    parts.push(
      `Prior steps in this execution:\n${Object.entries(context.executionResults)
        .map(([step, r]) => `  Step ${step} (${r.agent}): ${r.success ? 'ok' : 'failed'}`)
        .join('\n')}`
    );
  }

  return parts.length > 0 ? parts.join('\n\n') : '(no prior context)';
}

function buildSourceCheck(context, extraSources = []) {
  const sources = [];

  if (extraSources?.length > 0) {
    sources.push(...extraSources.filter(Boolean));
  }

  if (context?.activeFolder?.folderPath) {
    const folderName =
      path.basename(context.activeFolder.folderPath) || context.activeFolder.folderPath;
    sources.push(`active folder scope (${folderName})`);
  }

  if (context?.relevantDocuments?.length > 0) {
    sources.push(`relevant documents (${context.relevantDocuments.length})`);
  }

  if (context?.recentConversations?.length > 0) {
    sources.push(`recent conversations (${context.recentConversations.length})`);
  }

  if (context?.memories?.length > 0) {
    sources.push(`recent memories (${context.memories.length})`);
  }

  if (context?.activeTasks?.length > 0) {
    sources.push(`active tasks (${context.activeTasks.length})`);
  }

  if (context?.upcomingEvents?.length > 0) {
    sources.push(`upcoming events (${context.upcomingEvents.length})`);
  }

  if (context?.parsedParameters?.dueAt || context?.parsedParameters?.startsAt) {
    sources.push('pre-parsed temporal parameters');
  }

  if (sources.length === 0) {
    sources.push('no retrieved context');
  }

  return `Source check: ${sources.join(', ')}.`;
}

function prefixWithSourceCheck(content, context, extraSources = []) {
  if (process.env.SHOW_AGENT_SOURCES !== 'true') {
    return content || '';
  }
  const sourceLine = buildSourceCheck(context, extraSources);
  if (!content) return sourceLine;
  if (String(content).startsWith('Source check: ')) return content;
  return `${sourceLine}\n\n${content}`;
}

module.exports = {
  buildContext,
  buildSystemPromptContext,
  buildSourceCheck,
  prefixWithSourceCheck,
};

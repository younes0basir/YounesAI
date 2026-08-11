/**
 * System news / announcements feed.
 *
 * Currently returns a curated list of recent product updates.
 * In the future this can be backed by a `news` table, feature flags,
 * or an external changelog feed.
 */

const newsItems = [
  {
    id: 'news-2026-08-10-1',
    date: '2026-08-10',
    category: 'fix',
    title: 'Image generation preview fixed',
    body: 'NVIDIA FLUX.2 Klein responses are now parsed correctly and the image generator UI shows a live status log.',
    link: null,
  },
  {
    id: 'news-2026-08-10-2',
    date: '2026-08-10',
    category: 'fix',
    title: 'Monitoring calls no longer double-prefix /api',
    body: 'The Agents dashboard monitoring and evaluation requests now use the shared Axios baseURL correctly.',
    link: null,
  },
  {
    id: 'news-2026-08-10-3',
    date: '2026-08-10',
    category: 'feature',
    title: 'Orchestrator now knows every specialist agent',
    body: 'The orchestrator prompt and the AI Control Center dashboard now list general, desktop, and gemma alongside the existing agents.',
    link: null,
  },
  {
    id: 'news-2026-08-10-4',
    date: '2026-08-10',
    category: 'architecture',
    title: 'Phase 2 architecture freeze complete',
    body: 'Agents no longer directly query PostgreSQL. All database access flows through the tool layer: Agent → Tool → Service → Database.',
    link: null,
  },
  {
    id: 'news-2026-08-10-5',
    date: '2026-08-10',
    category: 'security',
    title: 'Security triage complete',
    body: 'Unauthenticated /voice/transcribe and /agents/status endpoints are now protected, projects are scoped by ownership/membership, and API keys were removed from .env.example.',
    link: null,
  },
];

function getNews(options = {}) {
  const limit = Math.max(1, Math.min(options.limit || 10, 100));
  const category = options.category || null;

  let items = newsItems.slice();

  if (category) {
    items = items.filter((item) => item.category === category);
  }

  items.sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    success: true,
    items: items.slice(0, limit),
    total: items.length,
  };
}

module.exports = { getNews };

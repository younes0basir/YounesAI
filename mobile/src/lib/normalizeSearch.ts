import type { SearchResult } from '@/lib/types';

interface SearchApiResponse {
  tasks?: Array<{ id: string; title: string; description?: string | null }>;
  files?: Array<{ id: string; name: string; path?: string | null }>;
  places?: Array<{ id: string; name: string; address?: string | null; notes?: string | null }>;
}

/** Backend /api/search returns grouped objects, not a flat array. */
export function normalizeSearchResults(data: unknown): SearchResult[] {
  if (Array.isArray(data)) return data as SearchResult[];
  if (!data || typeof data !== 'object') return [];

  const payload = data as SearchApiResponse;
  const tasks = (payload.tasks ?? []).map((item) => ({
    type: 'task',
    id: item.id,
    title: item.title,
    snippet: item.description ?? null,
  }));
  const files = (payload.files ?? []).map((item) => ({
    type: 'file',
    id: item.id,
    title: item.name,
    snippet: item.path ?? null,
  }));
  const places = (payload.places ?? []).map((item) => ({
    type: 'place',
    id: item.id,
    title: item.name,
    snippet: item.address ?? item.notes ?? null,
  }));

  return [...tasks, ...files, ...places];
}

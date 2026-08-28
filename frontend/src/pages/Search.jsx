import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search as SearchIcon, CheckSquare, File, MapPin } from 'lucide-react';
import { useGlobalSearch } from '../hooks/useSearch';
import PageHeader from '../components/ui/PageHeader';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';

const sectionMeta = {
  tasks: { icon: CheckSquare, tone: 'text-emerald-600 bg-emerald-50' },
  files: { icon: File, tone: 'text-slate-600 bg-slate-100' },
  places: { icon: MapPin, tone: 'text-rose-600 bg-rose-50' },
};

export default function SearchPage() {
  const location = useLocation();
  const initialQuery = useMemo(
    () => new URLSearchParams(location.search).get('q') || '',
    [location.search]
  );
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);
  const normalized = useMemo(() => query.trim(), [query]);
  const { data, isLoading, isError, refetch } = useGlobalSearch(normalized);

  const tasks = data?.tasks || [];
  const files = data?.files || [];
  const places = data?.places || [];
  const total = tasks.length + files.length + places.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Search"
        description="Find tasks, files, and places across your workspace."
      />

      <div className="surface-elevated p-4">
        <div className="flex items-center gap-3 border border-slate-200/70 rounded-2xl px-4 py-3 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 transition-all bg-white/80 backdrop-blur-sm">
          <SearchIcon size={18} className="text-slate-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anything..."
            className="w-full outline-none text-sm text-slate-800 placeholder:text-slate-400"
            autoFocus
          />
        </div>
      </div>

      {!normalized ? (
        <p className="text-sm text-slate-400 px-1">Start typing to search your workspace.</p>
      ) : isError ? (
        <ErrorState
          title="Search failed"
          description="Could not complete your search. Please try again."
          onRetry={refetch}
        />
      ) : isLoading ? (
        <LoadingState message="Searching..." />
      ) : (
        <>
          <p className="text-sm text-slate-500 px-1">
            {total} result{total !== 1 ? 's' : ''} for{' '}
            <span className="font-semibold text-slate-700">&quot;{normalized}&quot;</span>
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            <ResultCard
              section="tasks"
              title="Tasks"
              items={tasks}
              render={(item) => (
                <>
                  <div className="font-medium text-slate-900">{item.title}</div>
                  {item.description ? (
                    <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                  ) : null}
                </>
              )}
            />
            <ResultCard
              section="files"
              title="Files"
              items={files}
              render={(item) => (
                <>
                  <div className="font-medium text-slate-900">{item.name}</div>
                  {item.path ? (
                    <div className="text-xs text-slate-500 truncate mt-0.5">{item.path}</div>
                  ) : null}
                </>
              )}
            />
            <ResultCard
              section="places"
              title="Places"
              items={places}
              render={(item) => (
                <>
                  <div className="font-medium text-slate-900">{item.name}</div>
                  {item.address ? (
                    <div className="text-xs text-slate-500 mt-0.5">{item.address}</div>
                  ) : null}
                </>
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ResultCard({ section, title, items, render }) {
  const meta = sectionMeta[section];
  const Icon = meta.icon;

  return (
    <div className="surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={`nav-icon ${meta.tone}`}>
          <Icon size={14} />
        </span>
        <h3 className="text-sm font-semibold text-slate-800">
          {title} <span className="text-slate-400 font-normal">({items.length})</span>
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">No matches</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-100 p-3 hover:border-primary-200 hover:bg-primary-50/30 transition-colors"
            >
              {render(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

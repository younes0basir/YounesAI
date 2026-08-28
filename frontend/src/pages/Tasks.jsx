import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  useTasks,
  useSmartTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from '../hooks/useTasks';
import PageHeader from '../components/ui/PageHeader';
import FilterPills from '../components/ui/FilterPills';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import ConfirmModal from '../components/ui/ConfirmModal';
import toast from 'react-hot-toast';
import { CheckSquare, Plus, Trash2, Star } from 'lucide-react';

const statusLabels = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
  archived: 'Archived',
};
const statusBadge = {
  pending: 'badge-pending',
  in_progress: 'badge-progress',
  done: 'badge-done',
  cancelled: 'badge-muted',
  archived: 'badge-muted',
};

function parseChecklist(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function Tasks() {
  const location = useLocation();
  const urlQuery = useMemo(
    () => new URLSearchParams(location.search).get('q') || '',
    [location.search]
  );
  const [filter, setFilter] = useState('all');
  const [smartFilter, setSmartFilter] = useState('all');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [details, setDetails] = useState('');
  const [checklistText, setChecklistText] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState('');
  const [urgency, setUrgency] = useState(3);
  const [priority, setPriority] = useState(3);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const { data, isLoading, isError, refetch } = useTasks();
  const {
    data: smartData,
    isLoading: isSmartLoading,
    isError: isSmartError,
    refetch: refetchSmart,
  } = useSmartTasks(smartFilter);
  const create = useCreateTask();
  const update = useUpdateTask();
  const del = useDeleteTask();

  const tasks = Array.isArray(data) ? data : [];
  const sourceTasks = smartFilter === 'all' ? tasks : Array.isArray(smartData) ? smartData : [];
  const searchedTasks = !urlQuery
    ? sourceTasks
    : sourceTasks.filter((t) => {
        const hay = `${t.title || ''} ${t.description || ''} ${t.details || ''}`.toLowerCase();
        return hay.includes(urlQuery.toLowerCase());
      });
  const filtered =
    filter === 'all' ? searchedTasks : searchedTasks.filter((t) => t.status === filter);

  const onCreate = async () => {
    if (!title.trim()) return;
    await create.mutateAsync({
      title: title.trim(),
      description: description.trim() || null,
      details: details.trim() || null,
      checklist: parseChecklist(checklistText),
      due_at: dueAt || null,
      recurrence_rule: recurrenceRule || null,
      urgency,
      priority,
      is_favorite: isFavorite,
    });
    setTitle('');
    setDescription('');
    setDetails('');
    setChecklistText('');
    setDueAt('');
    setRecurrenceRule('');
    setUrgency(3);
    setPriority(3);
    setIsFavorite(false);
    setShowForm(false);
    toast.success('Task created');
  };

  const toggleDone = (task) => {
    const nextStatus = task.status === 'done' ? 'pending' : 'done';
    update.mutate({
      id: task.id,
      status: nextStatus,
      completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
    });
  };

  const toggleFavorite = (task) => {
    update.mutate({ id: task.id, is_favorite: !task.is_favorite });
  };

  const deleteTask = (id) => {
    setConfirmDeleteId(id);
  };

  const statusFilters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'done', label: 'Done' },
  ];

  const smartFilters = [
    { key: 'all', label: 'All tasks' },
    { key: 'today', label: 'Today' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'high_priority', label: 'High priority' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        description="Capture details, checklists, and priorities in one place."
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
            <Plus size={16} /> {showForm ? 'Close' : 'New task'}
          </button>
        }
      />

      {showForm && (
        <div className="surface-elevated p-5 space-y-3 animate-fade-up">
          <input
            autoFocus
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            onKeyDown={(e) => e.key === 'Enter' && onCreate()}
          />
          <textarea
            className="textarea"
            rows="2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short summary"
          />
          <textarea
            className="textarea"
            rows="3"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="More details or notes"
          />
          <textarea
            className="textarea"
            rows="2"
            value={checklistText}
            onChange={(e) => setChecklistText(e.target.value)}
            placeholder="Checklist items (one per line or comma separated)"
          />
          <div className="grid gap-3 md:grid-cols-4">
            <input
              type="datetime-local"
              className="input"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
            <select
              className="select"
              value={recurrenceRule}
              onChange={(e) => setRecurrenceRule(e.target.value)}
            >
              <option value="">No recurrence</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <select
              className="select"
              value={urgency}
              onChange={(e) => setUrgency(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((u) => (
                <option key={u} value={u}>
                  Urgency {u}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((u) => (
                <option key={u} value={u}>
                  Priority {u}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setIsFavorite((v) => !v)}
              className={`btn ${isFavorite ? 'btn-secondary border-amber-200 bg-amber-50 text-amber-700' : 'btn-secondary'}`}
            >
              <Star size={14} className={isFavorite ? 'fill-amber-400 text-amber-400' : ''} />
              {isFavorite ? 'Favorite' : 'Mark favorite'}
            </button>
            <button onClick={onCreate} disabled={create.isPending} className="btn btn-primary">
              Add task
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <FilterPills
          items={smartFilters}
          value={smartFilter}
          onChange={setSmartFilter}
          variant="accent"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterPills items={statusFilters} value={filter} onChange={setFilter} />
          <span className="ml-auto text-sm text-slate-400">{filtered.length} tasks</span>
        </div>
      </div>

      {urlQuery ? (
        <div className="text-sm text-slate-500 px-1">
          Results for <span className="font-semibold text-slate-700">&quot;{urlQuery}&quot;</span>
        </div>
      ) : null}

      <div className="space-y-3">
        {isError || (smartFilter !== 'all' && isSmartError) ? (
          <ErrorState
            title="Could not load tasks"
            onRetry={() => {
              refetch();
              if (smartFilter !== 'all') refetchSmart();
            }}
          />
        ) : isLoading || isSmartLoading ? (
          <LoadingState message="Loading tasks..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title={`No tasks${filter !== 'all' ? ` ${statusLabels[filter]?.toLowerCase()}` : ''}`}
            description="Create your first task or adjust filters."
            action={
              <button onClick={() => setShowForm(true)} className="btn btn-primary text-sm">
                New task
              </button>
            }
          />
        ) : (
          filtered.map((t) => {
            const checklist = parseChecklist(t.checklist);
            const doneChecklistCount = checklist.filter((item) => /^\s*\[x\]/i.test(item)).length;
            const progress =
              checklist.length > 0
                ? Math.round((doneChecklistCount / checklist.length) * 100)
                : null;
            const overdue = t.due_at && t.status !== 'done' && new Date(t.due_at) < new Date();

            return (
              <div key={t.id} className="surface surface-interactive p-4 group">
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => toggleDone(t)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      t.status === 'done'
                        ? 'bg-primary-500 border-primary-500 text-white scale-100'
                        : 'border-slate-300 hover:border-primary-400 hover:bg-primary-50'
                    }`}
                  >
                    {t.status === 'done' ? <span className="text-[10px]">✓</span> : null}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className={`font-semibold ${t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}
                      >
                        {t.title}
                      </div>
                      {t.is_favorite ? (
                        <Star size={14} className="fill-amber-400 text-amber-400 shrink-0" />
                      ) : null}
                    </div>
                    {t.description ? (
                      <p className="mt-1 text-sm text-slate-600">{t.description}</p>
                    ) : null}
                    {t.details ? <p className="mt-1 text-sm text-slate-500">{t.details}</p> : null}
                    {checklist.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm text-slate-500">
                        {checklist.slice(0, 3).map((item, index) => (
                          <li key={`${t.id}-${index}`} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {progress !== null ? (
                      <div className="mt-3 max-w-xs">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span>Subtask progress</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className={`badge ${statusBadge[t.status] || 'badge-muted'}`}>
                        {statusLabels[t.status] || t.status}
                      </span>
                      {t.urgency ? (
                        <span className="badge badge-urgent">Urgency {t.urgency}</span>
                      ) : null}
                      {t.priority ? (
                        <span className="badge badge-priority">Priority {t.priority}</span>
                      ) : null}
                      {t.due_at ? (
                        <span
                          className={`text-xs ${overdue ? 'text-rose-600 font-medium' : 'text-slate-400'}`}
                        >
                          {overdue ? 'Overdue · ' : 'Due '}
                          {new Date(t.due_at).toLocaleDateString()}
                        </span>
                      ) : null}
                      {t.recurrence_rule ? (
                        <span className="badge badge-repeat">Repeats {t.recurrence_rule}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleFavorite(t)}
                      className="btn-icon hover:text-amber-500"
                      aria-label={t.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star
                        size={16}
                        className={t.is_favorite ? 'fill-amber-400 text-amber-400' : ''}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTask(t.id)}
                      className="btn-icon hover:text-rose-500"
                      aria-label="Delete task"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmModal
        open={!!confirmDeleteId}
        title="Delete this task?"
        description="This will permanently remove the task. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDeleteId) del.mutate(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

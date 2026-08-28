import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useEmails,
  useEmailDetail,
  useEmailAction,
  useEmailBatchAction,
  usePendingApprovals,
  useResolveApproval,
  useSyncGmail,
  useGmailAccounts,
  useGmailSyncStatus,
  EMAIL_CATEGORIES,
  AI_INBOX_FILTER,
} from '../hooks/useEmail';
import PageHeader from '../components/ui/PageHeader';
import FilterPills from '../components/ui/FilterPills';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import AIStateCard from '../components/ui/AIStateCard';
import ConfirmModal from '../components/ui/ConfirmModal';
import toast from 'react-hot-toast';
import {
  Archive,
  Trash2,
  Star,
  VolumeX,
  CheckSquare,
  RefreshCw,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Search,
  Loader2,
  Mail,
  Unplug,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { format, formatDistanceToNow, isValid } from 'date-fns';

const PAGE_SIZE = 50;

const categoryFilters = [
  { key: AI_INBOX_FILTER, label: 'AI Inbox' },
  ...EMAIL_CATEGORIES.map((c) => ({ key: c.id, label: c.label })),
  { key: 'ALL', label: 'All synced' },
];

function categoryTone(cat) {
  return EMAIL_CATEGORIES.find((c) => c.id === cat)?.tone || 'bg-slate-50 text-slate-500';
}

function EvidencePanel({ evidence, source }) {
  if (!evidence) return null;
  let parsed = evidence;
  try {
    parsed = typeof evidence === 'string' ? JSON.parse(evidence) : evidence;
  } catch {
    return (
      <div className="mt-2 p-3 rounded-xl bg-white/60 border border-slate-200/60 text-xs text-slate-600">
        <div className="font-semibold text-slate-700">Classification evidence ({source})</div>
        <p className="mt-1">{parsed}</p>
      </div>
    );
  }
  return (
    <div className="mt-2 p-3 rounded-xl bg-white/60 border border-slate-200/60 text-xs text-slate-600 space-y-1">
      <div className="font-semibold text-slate-700">Classification evidence ({source})</div>
      {parsed.reasoning && <p>{parsed.reasoning}</p>}
      {parsed.ruleName && <p>Rule: {parsed.ruleName}</p>}
      {Array.isArray(parsed.signals) && parsed.signals.length > 0 && (
        <ul className="list-disc pl-4">
          {parsed.signals.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      {parsed.senderAddress && <p>Learned from sender: {parsed.senderAddress}</p>}
    </div>
  );
}

export default function Inbox() {
  const nav = useNavigate();
  const [category, setCategory] = useState(AI_INBOX_FILTER);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [busyMap, setBusyMap] = useState({});
  const [summaries, setSummaries] = useState({});
  const [confirm, setConfirm] = useState(null);

  const { data: accounts } = useGmailAccounts();
  const { data: syncStatus } = useGmailSyncStatus();
  const { data: emailsPage, isLoading, isFetching, isError, refetch } = useEmails(category, page);
  const { data: detail } = useEmailDetail(expandedId);
  const { data: approvals = [] } = usePendingApprovals();
  const emailAction = useEmailAction();
  const batchAction = useEmailBatchAction();
  const resolveApproval = useResolveApproval();
  const syncGmail = useSyncGmail();

  const list = useMemo(() => (Array.isArray(emailsPage) ? emailsPage : []), [emailsPage]);
  const accountList = Array.isArray(accounts) ? accounts : [];
  const syncRows = Array.isArray(syncStatus) ? syncStatus : [];
  const pending = Array.isArray(approvals) ? approvals : [];

  useEffect(() => {
    setPage(1);
    setLoaded([]);
  }, [category]);

  useEffect(() => {
    if (list.length === 0) return;
    if (page === 1) {
      setLoaded(list);
      return;
    }
    setLoaded((prev) => {
      const ids = new Set(prev.map((e) => e.id));
      return [...prev, ...list.filter((e) => !ids.has(e.id))];
    });
  }, [list, page]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return loaded;
    return loaded.filter((e) =>
      [e.subject, e.from_name, e.from_address, e.snippet, e.body_text]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [loaded, query]);

  const visibleIds = filtered.map((e) => e.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const hasMore = list.length === PAGE_SIZE;

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const startBusy = (id, action) => setBusyMap((m) => ({ ...m, [id]: action }));
  const stopBusy = (id) =>
    setBusyMap((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });

  const refetchFirstPage = () => {
    setPage(1);
    setSelected(new Set());
    refetch();
  };

  const runAction = async (emailId, action) => {
    startBusy(emailId, action);
    try {
      const res = await emailAction.mutateAsync({ emailId, action });
      if (res?.summary) {
        setSummaries((s) => ({ ...s, [emailId]: res.summary }));
        toast.success(action === 'summarize' ? 'Summary ready' : res.summary.slice(0, 120));
      } else {
        toast.success(`Action "${action}" completed`);
      }
      refetchFirstPage();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      stopBusy(emailId);
    }
  };

  const requestDelete = (emailId, subject) => {
    setConfirm({
      kind: 'single',
      emailId,
      description: `Permanently delete "${subject || '(no subject)'}" and its attachments (if synced)?`,
    });
  };

  const requestBatchDelete = (ids) => {
    setConfirm({
      kind: 'batch',
      description: `Permanently delete ${ids.length} selected email(s)?`,
    });
  };

  const confirmDelete = async () => {
    setConfirm(null);
    if (confirm.kind === 'single') {
      await runAction(confirm.emailId, 'delete');
    } else {
      await runBatch('delete');
    }
  };

  const runBatch = async (action) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      const res = await batchAction.mutateAsync({ action, emailIds: ids });
      if (res.requiresApproval) {
        toast('Batch action sent for approval', { icon: '🛡️' });
      } else {
        toast.success(`Applied ${action} to ${ids.length} email(s)`);
      }
      setSelected(new Set());
      refetchFirstPage();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const runSync = () => {
    syncGmail.mutate(null, {
      onSuccess: () => toast.success('Sync started'),
      onError: (e) => toast.error(e.response?.data?.error || 'Sync failed'),
    });
  };

  const connected = accountList.length > 0;
  const failedSync = syncRows.find((s) => s.sync_status === 'error' || s.last_sync_error);
  const totalSynced = syncRows.reduce((n, s) => n + (Number(s.messages_synced) || 0), 0);
  const latestSyncAt = syncRows
    .map((s) => s.last_sync_at)
    .filter(Boolean)
    .sort()
    .pop();

  const subtitle = () => {
    const parts = [];
    if (pending.length > 0) parts.push(`${pending.length} approval(s) pending`);
    if (!connected) parts.push('Gmail not connected');
    else {
      parts.push(`${syncRows.length} account(s)`);
      if (totalSynced > 0) parts.push(`${totalSynced} message(s) synced`);
      if (latestSyncAt)
        parts.push(`last sync ${formatDistanceToNow(new Date(latestSyncAt), { addSuffix: true })}`);
    }
    parts.push(`${filtered.length} message(s) shown`);
    return parts.join(' · ');
  };

  const busyLabel = (id, action) => (busyMap[id] === action ? 'running' : 'idle');

  const renderActionButton = (id, action, label, icon, opts = {}) => {
    const running = busyLabel(id, action) === 'running';
    return (
      <button
        type="button"
        className={`btn btn-ghost text-xs ${opts.danger ? 'text-rose-600' : ''}`}
        onClick={() => runAction(id, action)}
        disabled={running}
        aria-busy={running}
      >
        {running ? <Loader2 size={13} className="animate-spin" /> : icon}
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Inbox"
        description={subtitle()}
        kicker="Email"
        action={
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={runSync}
            disabled={syncGmail.isPending}
          >
            <RefreshCw size={15} className={syncGmail.isPending ? 'animate-spin' : ''} />
            {syncGmail.isPending ? 'Syncing…' : 'Sync'}
          </button>
        }
      />

      {/* Connection / sync status banner */}
      <div
        className={`surface p-3 flex flex-wrap items-center gap-3 ${
          failedSync ? 'border-rose-200/70' : connected ? '' : 'border-amber-200/70'
        }`}
      >
        {failedSync ? (
          <span className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={17} className="text-rose-600" />
          </span>
        ) : connected ? (
          <span className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 size={17} className="text-emerald-600" />
          </span>
        ) : (
          <span className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Unplug size={17} className="text-amber-600" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          {failedSync ? (
            <>
              <div className="text-sm font-semibold text-slate-800">Sync problem detected</div>
              <div className="text-xs text-slate-500 break-words">{failedSync.last_sync_error}</div>
            </>
          ) : connected ? (
            <>
              <div className="text-sm font-semibold text-slate-800 truncate">
                {syncRows
                  .map((s) => s.email_address)
                  .filter(Boolean)
                  .join(', ') || accountList.map((a) => a.email_address).join(', ')}
              </div>
              <div className="text-xs text-slate-500">
                {totalSynced > 0 ? `${totalSynced} message(s) synced` : 'Connected'} ·{' '}
                {latestSyncAt
                  ? `last sync ${formatDistanceToNow(new Date(latestSyncAt), { addSuffix: true })}`
                  : 'not synced yet'}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-slate-800">
                Connect Gmail to unlock the AI Inbox
              </div>
              <div className="text-xs text-slate-500">
                Syncing brings messages in and lets the AI classify, summarize, and triage them
                automatically.
              </div>
            </>
          )}
        </div>
        {connected ? (
          <button
            type="button"
            className="btn btn-secondary text-xs"
            onClick={runSync}
            disabled={syncGmail.isPending}
          >
            <RefreshCw size={13} className={syncGmail.isPending ? 'animate-spin' : ''} />
            Retry sync
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary text-xs"
            onClick={() => nav('/settings')}
          >
            <Mail size={13} /> Connect Gmail
          </button>
        )}
      </div>

      {pending.map((ap) => (
        <AIStateCard
          key={ap.id}
          state="approval"
          message={ap.summary || `Pending ${ap.action_type} approval`}
          actions={
            <>
              <button
                type="button"
                className="btn btn-primary text-xs"
                disabled={resolveApproval.isPending}
                onClick={() =>
                  resolveApproval.mutate(
                    { id: ap.id, approve: true },
                    {
                      onSuccess: (r) => toast.success(`Approved — ${r.executed} executed`),
                      onError: (e) => toast.error(e.response?.data?.error || 'Approval failed'),
                    }
                  )
                }
              >
                Approve
              </button>
              <button
                type="button"
                className="btn btn-secondary text-xs"
                disabled={resolveApproval.isPending}
                onClick={() =>
                  resolveApproval.mutate(
                    { id: ap.id, approve: false },
                    {
                      onSuccess: () => toast.success('Rejected'),
                      onError: (e) => toast.error(e.response?.data?.error || 'Rejection failed'),
                    }
                  )
                }
              >
                Reject
              </button>
            </>
          }
        />
      ))}

      <FilterPills items={categoryFilters} value={category} onChange={setCategory} />

      {/* Toolbar: search + select all */}
      <div className="surface p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className="input pl-9"
            placeholder="Search subject, sender, or body…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary text-xs"
          onClick={toggleAllVisible}
          disabled={visibleIds.length === 0}
        >
          {allVisibleSelected ? 'Deselect all' : `Select all (${visibleIds.length})`}
        </button>
        {query && (
          <button type="button" className="btn btn-ghost text-xs" onClick={() => setQuery('')}>
            Clear search
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="surface p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{selected.size} selected</span>
          <button
            type="button"
            className="btn btn-secondary text-xs"
            disabled={batchAction.isPending}
            onClick={() => runBatch('archive')}
          >
            <Archive size={14} /> Archive selected
          </button>
          <button
            type="button"
            className="btn btn-secondary text-xs text-rose-600"
            disabled={batchAction.isPending}
            onClick={() => requestBatchDelete([...selected])}
          >
            <Trash2 size={14} /> Delete selected
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {isLoading && loaded.length === 0 && <LoadingState message="Loading inbox…" />}
      {isError && <ErrorState message="Could not load emails" onRetry={refetch} />}

      {!isLoading && !isError && loaded.length === 0 && (
        <EmptyState
          title={category === AI_INBOX_FILTER ? 'No important emails right now' : 'No emails yet'}
          description={
            category === AI_INBOX_FILTER
              ? 'AI Inbox shows only Important and Action Required messages. Sync Gmail and ensure NVIDIA_EMAIL_API_KEY is set in backend/.env to classify messages.'
              : 'Connect Gmail in Settings and run a sync to populate your AI Inbox.'
          }
          action={
            <button
              type="button"
              className="btn btn-primary text-sm"
              onClick={() => nav('/settings')}
            >
              Go to Settings
            </button>
          }
        />
      )}

      {!isLoading && !isError && loaded.length > 0 && filtered.length === 0 && (
        <EmptyState
          title={`No results for "${query}"`}
          description="Try different keywords, or clear the search to see all messages."
          action={
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => setQuery('')}
            >
              Clear search
            </button>
          }
        />
      )}

      <div className="space-y-3">
        {filtered.map((email) => {
          const isExpanded = expandedId === email.id;
          const isBusy = Boolean(busyMap[email.id]);
          const summary = summaries[email.id];
          const expandedDetail = isExpanded ? detail : null;
          return (
            <article
              key={email.id}
              className={`surface p-4 ${isExpanded ? 'ring-1 ring-primary-200' : ''}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(email.id)}
                  onChange={() => toggleSelect(email.id)}
                  aria-label={`Select email ${email.subject}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`badge text-[10px] ${categoryTone(email.category)}`}>
                      {email.category || 'UNKNOWN'}
                    </span>
                    {email.confidence != null && (
                      <span className="text-[10px] text-slate-400">
                        {Math.round(email.confidence * 100)}% · {email.classification_source || '—'}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {email.received_at
                        ? formatDistanceToNow(new Date(email.received_at), { addSuffix: true })
                        : ''}
                    </span>
                  </div>
                  <h3
                    className={`text-sm truncate ${email.is_read ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}
                  >
                    {email.subject || '(no subject)'}
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    {email.from_name || email.from_address}{' '}
                    {email.from_name && email.from_address ? `· ${email.from_address}` : ''}
                    {email.account_email && (
                      <span className="text-slate-400"> · via {email.account_email}</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                    {email.snippet || email.body_text}
                  </p>

                  {summary && (
                    <div className="mt-2 p-3 rounded-xl bg-primary-50 border border-primary-200/60 text-xs text-slate-700">
                      <div className="font-semibold text-primary-700 mb-1">AI summary</div>
                      <p>{summary}</p>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-3 space-y-3">
                      {expandedDetail?.body_text && (
                        <div className="p-3 rounded-xl bg-white/70 border border-slate-200/60 text-sm text-slate-700 whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
                          {expandedDetail.body_text}
                        </div>
                      )}
                      {expandedDetail && (
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600">
                          {expandedDetail.to_addresses && (
                            <>
                              <dt className="font-semibold text-slate-700">To</dt>
                              <dd>{expandedDetail.to_addresses}</dd>
                            </>
                          )}
                          {expandedDetail.received_at && (
                            <>
                              <dt className="font-semibold text-slate-700">Received</dt>
                              <dd>
                                {isValid(new Date(expandedDetail.received_at))
                                  ? format(new Date(expandedDetail.received_at), 'PPP · p')
                                  : expandedDetail.received_at}
                              </dd>
                            </>
                          )}
                          {expandedDetail.account_email && (
                            <>
                              <dt className="font-semibold text-slate-700">Account</dt>
                              <dd>{expandedDetail.account_email}</dd>
                            </>
                          )}
                        </dl>
                      )}
                      <EvidencePanel
                        evidence={email.evidence}
                        source={email.classification_source}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() => runAction(email.id, 'archive')}
                    >
                      {busyMap[email.id] === 'archive' ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Archive size={13} />
                      )}{' '}
                      Archive
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-xs text-rose-600"
                      onClick={() => requestDelete(email.id, email.subject)}
                    >
                      {busyMap[email.id] === 'delete' ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}{' '}
                      Delete
                    </button>
                    {renderActionButton(
                      email.id,
                      'mark_important',
                      'Important',
                      <Star size={13} />
                    )}
                    {renderActionButton(email.id, 'mute_sender', 'Mute', <VolumeX size={13} />)}
                    {renderActionButton(email.id, 'create_task', 'Task', <CheckSquare size={13} />)}
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() => runAction(email.id, 'summarize')}
                      disabled={busyMap[email.id] === 'summarize'}
                    >
                      {busyMap[email.id] === 'summarize' ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <SparkleSvg />
                      )}{' '}
                      Summarize
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() =>
                        nav('/chat', {
                          state: {
                            prefilled: `Tell me about this email from ${email.from_address}: "${email.subject}"`,
                          },
                        })
                      }
                    >
                      <MessageSquare size={13} /> Ask AI
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() => setExpandedId(isExpanded ? null : email.id)}
                      disabled={isBusy}
                    >
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      <HelpCircle size={13} /> {isExpanded ? 'Hide details' : 'Why?'}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <ChevronDown size={15} />
            )}
            {isFetching ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          open
          title="Delete email(s)?"
          description={confirm.description}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setConfirm(null)}
          danger
        />
      )}
    </div>
  );
}

function SparkleSvg() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
    </svg>
  );
}

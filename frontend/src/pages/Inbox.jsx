import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useEmails,
  useEmailAction,
  useEmailBatchAction,
  usePendingApprovals,
  useResolveApproval,
  useSyncGmail,
  EMAIL_CATEGORIES,
} from '../hooks/useEmail'
import PageHeader from '../components/ui/PageHeader'
import FilterPills from '../components/ui/FilterPills'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import ErrorState from '../components/ui/ErrorState'
import AIStateCard from '../components/ui/AIStateCard'
import toast from 'react-hot-toast'
import {
  Archive, Trash2, Star, VolumeX, CheckSquare, RefreshCw,
  MessageSquare, ChevronDown, ChevronUp, HelpCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const categoryFilters = [{ key: 'ALL', label: 'All' }, ...EMAIL_CATEGORIES.map((c) => ({ key: c.id, label: c.label }))]

function categoryTone(cat) {
  return EMAIL_CATEGORIES.find((c) => c.id === cat)?.tone || 'bg-slate-50 text-slate-500'
}

function EvidencePanel({ evidence, source }) {
  if (!evidence) return null
  const parsed = typeof evidence === 'string' ? JSON.parse(evidence) : evidence
  return (
    <div className="mt-2 p-3 rounded-lg bg-slate-50 text-xs text-slate-600 space-y-1">
      <div className="font-semibold text-slate-700">Classification evidence ({source})</div>
      {parsed.reasoning && <p>{parsed.reasoning}</p>}
      {parsed.ruleName && <p>Rule: {parsed.ruleName}</p>}
      {parsed.signals?.length > 0 && (
        <ul className="list-disc pl-4">
          {parsed.signals.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      )}
      {parsed.senderAddress && <p>Learned from sender: {parsed.senderAddress}</p>}
    </div>
  )
}

export default function Inbox() {
  const nav = useNavigate()
  const [category, setCategory] = useState('ALL')
  const [selected, setSelected] = useState(new Set())
  const [expandedId, setExpandedId] = useState(null)

  const { data: emails, isLoading, isError, refetch } = useEmails(category)
  const { data: approvals } = usePendingApprovals()
  const emailAction = useEmailAction()
  const batchAction = useEmailBatchAction()
  const resolveApproval = useResolveApproval()
  const syncGmail = useSyncGmail()

  const list = Array.isArray(emails) ? emails : []
  const pending = Array.isArray(approvals) ? approvals : []

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runAction = async (emailId, action) => {
    try {
      const res = await emailAction.mutateAsync({ emailId, action })
      if (res.summary) toast.success(res.summary.slice(0, 120))
      else toast.success(`Action "${action}" completed`)
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const runBatch = async (action) => {
    const ids = [...selected]
    if (ids.length === 0) return
    try {
      const res = await batchAction.mutateAsync({ action, emailIds: ids })
      if (res.requiresApproval) {
        toast('Batch action sent for approval', { icon: '🛡️' })
      } else {
        toast.success(`Applied ${action} to ${ids.length} email(s)`)
        setSelected(new Set())
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const subtitle = pending.length > 0
    ? `${pending.length} approval(s) pending · ${list.length} message(s)`
    : `${list.length} message(s)`

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Inbox"
        description={subtitle}
        kicker="Email"
        action={
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => syncGmail.mutate(null, {
              onSuccess: () => toast.success('Sync started'),
              onError: (e) => toast.error(e.response?.data?.error || 'Sync failed'),
            })}
            disabled={syncGmail.isPending}
          >
            <RefreshCw size={15} className={syncGmail.isPending ? 'animate-spin' : ''} />
            Sync
          </button>
        }
      />

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
                onClick={() => resolveApproval.mutate({ id: ap.id, approve: true }, {
                  onSuccess: (r) => toast.success(`Approved — ${r.executed} executed`),
                })}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => resolveApproval.mutate({ id: ap.id, approve: false }, {
                  onSuccess: () => toast.success('Rejected'),
                })}
              >
                Reject
              </button>
            </>
          }
        />
      ))}

      <FilterPills items={categoryFilters} value={category} onChange={setCategory} />

      {selected.size > 0 && (
        <div className="surface p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">{selected.size} selected</span>
          <button type="button" className="btn btn-secondary text-xs" onClick={() => runBatch('archive')}>
            <Archive size={14} /> Archive selected
          </button>
          <button type="button" className="btn btn-secondary text-xs text-rose-600" onClick={() => runBatch('delete')}>
            <Trash2 size={14} /> Delete selected
          </button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {isLoading && <LoadingState message="Loading inbox…" />}
      {isError && <ErrorState message="Could not load emails" onRetry={refetch} />}
      {!isLoading && !isError && list.length === 0 && (
        <EmptyState
          title="No emails yet"
          description="Connect Gmail in Settings and run a sync to populate your AI Inbox."
          action={
            <button type="button" className="btn btn-primary text-sm" onClick={() => nav('/settings')}>
              Go to Settings
            </button>
          }
        />
      )}

      <div className="space-y-3">
        {list.map((email) => {
          const isExpanded = expandedId === email.id
          return (
            <article key={email.id} className="surface p-4">
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
                  <h3 className="text-sm font-semibold text-slate-800 truncate">{email.subject || '(no subject)'}</h3>
                  <p className="text-xs text-slate-500">{email.from_name || email.from_address}</p>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{email.snippet || email.body_text}</p>

                  {isExpanded && (
                    <EvidencePanel evidence={email.evidence} source={email.classification_source} />
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <button type="button" className="btn btn-ghost text-xs" onClick={() => runAction(email.id, 'archive')}>
                      <Archive size={13} /> Archive
                    </button>
                    <button type="button" className="btn btn-ghost text-xs text-rose-600" onClick={() => runAction(email.id, 'delete')}>
                      <Trash2 size={13} /> Delete
                    </button>
                    <button type="button" className="btn btn-ghost text-xs" onClick={() => runAction(email.id, 'mark_important')}>
                      <Star size={13} /> Important
                    </button>
                    <button type="button" className="btn btn-ghost text-xs" onClick={() => runAction(email.id, 'mute_sender')}>
                      <VolumeX size={13} /> Mute
                    </button>
                    <button type="button" className="btn btn-ghost text-xs" onClick={() => runAction(email.id, 'create_task')}>
                      <CheckSquare size={13} /> Task
                    </button>
                    <button type="button" className="btn btn-ghost text-xs" onClick={() => runAction(email.id, 'summarize')}>
                      Summarize
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() => nav('/chat', { state: { prefilled: `Tell me about this email from ${email.from_address}: "${email.subject}"` } })}
                    >
                      <MessageSquare size={13} /> Ask AI
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() => setExpandedId(isExpanded ? null : email.id)}
                    >
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      <HelpCircle size={13} /> Why?
                    </button>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

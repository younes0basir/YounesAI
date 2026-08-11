import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export function useTaskStats() {
  return useQuery({
    queryKey: ['task-stats'],
    queryFn: () => api.get('/tasks').then((r) => {
      const tasks = Array.isArray(r.data) ? r.data : []
      return {
        total: tasks.length,
        open: tasks.filter((t) => t.status === 'pending' || t.status === 'open' || t.status === 'in_progress').length,
        done: tasks.filter((t) => t.status === 'done').length,
      }
    }),
  })
}

export function useReminderCount() {
  return useQuery({
    queryKey: ['reminder-count'],
    queryFn: () => api.get('/reminders').then((r) => {
      const items = Array.isArray(r.data) ? r.data : []
      return items.length
    }),
  })
}

export function useEventCount() {
  return useQuery({
    queryKey: ['event-count'],
    queryFn: () => api.get('/calendar_events').then((r) => {
      const items = Array.isArray(r.data) ? r.data : []
      return items.length
    }),
  })
}

function formatActionLabel(actionType = 'Action') {
  return actionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function useRecentActivity(limit = 6) {
  return useQuery({
    queryKey: ['recent-activity', limit],
    queryFn: () => api.get('/agent_actions').then((r) => {
      const items = Array.isArray(r.data) ? r.data : []
      return items
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit)
        .map((a) => ({
          id: a.id,
          title: formatActionLabel(a.action_type),
          status: a.status || 'executed',
          time: a.created_at ? new Date(a.created_at).toLocaleDateString() : 'recent',
        }))
    }),
  })
}

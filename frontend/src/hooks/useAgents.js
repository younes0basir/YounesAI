import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export function useAgentStatus() {
  return useQuery({
    queryKey: ['agent-status'],
    queryFn: () => api.get('/agents/status').then((r) => r.data),
  })
}

export function useAgentSummary(hours = 24) {
  return useQuery({
    queryKey: ['agent-summary', hours],
    queryFn: () => api.get('/agents/metrics/summary', { params: { hours } }).then((r) => r.data),
  })
}

export function useAgentBenchmark(hours = 24) {
  return useQuery({
    queryKey: ['agent-benchmark', hours],
    queryFn: () => api.get('/agents/metrics/benchmark', { params: { hours } }).then((r) => r.data),
    refetchInterval: 30000,
  })
}


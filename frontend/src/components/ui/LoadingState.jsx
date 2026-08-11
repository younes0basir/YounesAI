import { Loader } from 'lucide-react'

export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
      <Loader size={18} className="animate-spin text-primary-500" />
      <span className="text-sm">{message}</span>
    </div>
  )
}

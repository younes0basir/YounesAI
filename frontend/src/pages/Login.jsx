import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useLogin } from '../hooks/useAuth'
import { useAuth } from '../stores/useAuth'
import { LogIn, Eye, EyeOff, AlertCircle, Sparkles } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const login = useLogin()
  const token = useAuth((s) => s.token)

  if (token) return <Navigate to="/" replace />

  const submit = (e) => {
    e.preventDefault()
    if (!email || !password) return
    login.mutate({ email, password })
  }

  const error = login.error?.response?.data?.error || (login.error ? 'Connection error — is the server running?' : null)

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex auth-gradient text-white p-12 flex-col justify-between">
        <div>
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center font-bold text-lg">AI</div>
          <h1 className="text-3xl font-bold mt-8 leading-tight">Your personal productivity workspace</h1>
          <p className="text-slate-300 mt-3 max-w-md text-sm leading-relaxed">
            Tasks, reminders, events, and files — organized in one calm, color-coded dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Sparkles size={16} />
          <span>Built for focus, not clutter</span>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10 bg-[#fafafa]">
        <form onSubmit={submit} className="w-full max-w-sm surface-elevated p-8 space-y-5 animate-fade-up">
          <div className="text-center lg:text-left">
            <div className="w-10 h-10 lg:hidden mx-auto rounded-xl bg-accent-600 flex items-center justify-center text-white font-bold">AI</div>
            <h2 className="text-2xl font-bold text-slate-900 mt-3">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-1">Sign in to your workspace</p>
          </div>

          {error ? (
            <div className="flex items-start gap-2.5 bg-rose-50 text-rose-700 text-sm rounded-xl px-3.5 py-2.5 border border-rose-100">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              autoFocus
              className={`input ${login.error ? 'border-rose-300' : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              onFocus={() => login.reset()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className={`input pr-10 ${login.error ? 'border-rose-300' : ''}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                onFocus={() => login.reset()}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={login.isPending} className="btn btn-primary w-full py-2.5">
            {login.isPending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogIn size={16} />}
            {login.isPending ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-slate-500">
            No account? <Link to="/auth/register" className="text-primary-600 font-semibold hover:text-primary-700">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

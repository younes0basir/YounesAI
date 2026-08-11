import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuth as useAuthStore } from '../stores/useAuth'

export function useLogin() {
  const nav = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn: (data) => api.post('/auth/login', data).then((r) => r.data),
    onSuccess: (data) => {
      setUser(data.user, data.token)
      toast.success('Signed in successfully')
      nav('/')
    },
    onError: (err) => {
      const msg = err.response?.data?.error || (err.code === 'ERR_NETWORK' ? 'Cannot reach server — start the backend' : 'Login failed')
      toast.error(msg)
    }
  })
}

export function useRegister() {
  const nav = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn: (data) => api.post('/auth/register', data).then((r) => r.data),
    onSuccess: (data) => {
      setUser(data.user, data.token)
      toast.success('Account created successfully')
      nav('/')
    },
    onError: (err) => {
      const msg = err.response?.data?.error || (err.code === 'ERR_NETWORK' ? 'Cannot reach server — start the backend' : 'Registration failed')
      toast.error(msg)
    }
  })
}

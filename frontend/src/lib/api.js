import axios from 'axios';
import { getBackendURL } from '../stores/useBackend';
import { useAuth } from '../stores/useAuth';

const api = axios.create({
  baseURL: getBackendURL(),
  headers: { 'Content-Type': 'application/json' },
});

// simple interceptor to attach token from localStorage (auth store will set it)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Resolve the backend per-request so switching mode takes effect immediately.
  config.baseURL = getBackendURL();
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register');

    if (status === 401 && !isAuthRoute) {
      const hadToken = Boolean(localStorage.getItem('token'));
      useAuth.getState().logout();
      if (hadToken && !window.location.pathname.startsWith('/auth/')) {
        window.location.assign('/auth/login?reason=session');
      }
    }

    return Promise.reject(error);
  }
);

export default api;

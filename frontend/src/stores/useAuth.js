import create from 'zustand';

const stored = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

export const useAuth = create((set) => ({
  user: stored(),
  token: localStorage.getItem('token') || null,
  setUser: (user, token) => {
    localStorage.setItem('token', token || '');
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },
}));

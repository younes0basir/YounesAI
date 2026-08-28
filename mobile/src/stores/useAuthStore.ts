import { create } from 'zustand';
import { api, getToken, setToken, clearToken, setUnauthorizedHandler } from '@/services/api';
import { authenticate, biometricsEnabled } from '@/services/biometrics';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  hydrated: boolean;
  /** True when a stored token exists but biometric unlock is still pending. */
  biometricLocked: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hydrated: false,
  biometricLocked: false,

  async login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password });
    await setToken(data.token);
    set({ user: data.user });
  },

  async register(email, password, displayName) {
    const { data } = await api.post('/api/auth/register', {
      email,
      password,
      display_name: displayName,
    });
    await setToken(data.token);
    set({ user: data.user });
  },

  async logout() {
    await clearToken();
    set({ user: null });
  },

  async hydrate() {
    const token = await getToken();
    if (!token) {
      set({ hydrated: true });
      return;
    }
    if (biometricsEnabled()) {
      // Hold the session behind a biometric gate until the user unlocks.
      set({ hydrated: true, biometricLocked: true });
      return;
    }
    await get().unlockWithBiometrics();
  },

  async unlockWithBiometrics() {
    if (biometricsEnabled()) {
      const ok = await authenticate('Unlock YounesAI');
      if (!ok) return false;
    }
    try {
      const { data } = await api.get('/api/auth/me');
      set({ user: data, hydrated: true, biometricLocked: false });
      return true;
    } catch {
      await clearToken();
      set({ user: null, hydrated: true, biometricLocked: false });
      return false;
    }
  },
}));

// A 401 anywhere in the app means the JWT is dead — drop back to login.
setUnauthorizedHandler(() => {
  useAuthStore.setState({ user: null });
});

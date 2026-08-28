import create from 'zustand';

const STORAGE_KEY = 'backend_mode';

const DEFAULT_MODE = 'deployed';

export const BACKEND_MODES = {
  deployed: {
    label: 'Deployed',
    url: import.meta.env.VITE_API_URL || 'http://84.8.220.241:3000/api',
    short: 'prod',
  },
  local: {
    label: 'Local',
    url: 'http://localhost:3000/api',
    short: 'local',
  },
};

const readMode = () => {
  try {
    const m = localStorage.getItem(STORAGE_KEY);
    return BACKEND_MODES[m] ? m : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
};

export const getBackendURL = () => BACKEND_MODES[readMode()].url;

export const useBackend = create((set) => ({
  mode: readMode(),
  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
    set({ mode });
  },
}));

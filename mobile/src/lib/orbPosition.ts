import { storage } from '@/services/mmkv';

export type OrbPosition = { x: number; y: number };

const ORB_KEY = 'younesai-orb-pos-v2';
const ORB_TIP_KEY = 'younesai-orb-tip-seen';

export function loadOrbPosition(): OrbPosition | null {
  try {
    const raw = storage.getString(ORB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrbPosition;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveOrbPosition(pos: OrbPosition): void {
  try {
    storage.set(ORB_KEY, JSON.stringify(pos));
  } catch {}
}

export function hasSeenOrbTip(): boolean {
  try {
    return storage.getString(ORB_TIP_KEY) === '1';
  } catch {
    return true;
  }
}

export function markOrbTipSeen(): void {
  try {
    storage.set(ORB_TIP_KEY, '1');
  } catch {}
}

// JS-thread clamp (used outside worklets)
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

// Worklet-safe clamp — call this inside Reanimated worklets
export function clampWorklet(n: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(n, min), max);
}

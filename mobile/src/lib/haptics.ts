import * as Haptics from 'expo-haptics';

/**
 * Centralized haptic vocabulary — tuned for tactile weight without spam.
 * All helpers are fire-and-forget and swallow errors (e.g. simulator).
 */

// ── Core primitives ───────────────────────────────────────────────

/** Light tick for presses, tab switches, and toggles. */
export function hapticTap(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium impact for confirmations / sheet snaps. */
export function hapticImpactMedium(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Heavy impact for destructive / milestone actions. */
export function hapticImpactHeavy(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/** Selection tick for scrubbing/pills and threshold crossings. */
export function hapticSelect(): void {
  void Haptics.selectionAsync().catch(() => {});
}

/** Success buzz for completed actions (archive, send, approve). */
export function hapticSuccess(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Warning buzz — e.g. near-threshold, cancel. */
export function hapticWarning(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** Error buzz — failed action. */
export function hapticError(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

// ── Threshold-aware helpers ─────────────────────────────────────

/**
 * Fires a selection tick exactly once when `value` crosses `threshold`
 * in the positive direction. Use with a worklet-side `hasTriggered` flag.
 * Returns true if tick fired.
 */
export function hapticThreshold(value: number, threshold: number, hasTriggered: boolean): boolean {
  if (!hasTriggered && Math.abs(value) >= threshold) {
    hapticSelect();
    return true;
  }
  return hasTriggered;
}

/** Sheet snap — medium impact, feels like a detent. */
export function hapticSheetSnap(): void {
  hapticImpactMedium();
}

/** Swipe milestone — light selection tick at 40/75% of threshold, heavy at 100%. */
export function hapticSwipeMilestone(progress: number): void {
  if (progress >= 1) hapticImpactHeavy();
  else if (progress >= 0.75) hapticSelect();
  else if (progress >= 0.4) hapticTap();
}

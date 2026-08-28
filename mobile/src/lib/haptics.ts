import * as Haptics from 'expo-haptics';

/** Light tick for presses, tab switches, and toggles. */
export function hapticTap(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Selection tick for scrubbing/pills. */
export function hapticSelect(): void {
  void Haptics.selectionAsync().catch(() => {});
}

/** Success buzz for completed actions (archive, send, approve). */
export function hapticSuccess(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

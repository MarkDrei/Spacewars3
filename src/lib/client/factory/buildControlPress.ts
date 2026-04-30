export const LONG_PRESS_INITIAL_DELAY_MS = 350;

export function getLongPressRepeatDelayMs(elapsedMs: number): number {
  if (elapsedMs >= 2500) return 60;
  if (elapsedMs >= 1800) return 90;
  if (elapsedMs >= 1200) return 130;
  if (elapsedMs >= 700) return 190;
  return 260;
}

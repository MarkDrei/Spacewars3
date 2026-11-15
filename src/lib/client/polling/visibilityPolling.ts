/**
 * Polling that pauses while the page is hidden (background tab, minimized window).
 *
 * Ticks are skipped while `document.hidden` is true; when the page becomes visible again `poll`
 * runs immediately so the user never looks at stale data. The caller performs the initial load.
 *
 * @returns cleanup function stopping the timer and the visibility listener
 */
export function startVisibilityAwarePolling(
  poll: () => void,
  intervalMs: number,
  doc: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'> | undefined =
    typeof document === 'undefined' ? undefined : document
): () => void {
  const isHidden = () => doc?.hidden ?? false;

  const interval = setInterval(() => {
    if (!isHidden()) poll();
  }, intervalMs);

  let wasHidden = isHidden();
  const onVisibilityChange = () => {
    const hidden = isHidden();
    if (wasHidden && !hidden) poll();
    wasHidden = hidden;
  };
  doc?.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    clearInterval(interval);
    doc?.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

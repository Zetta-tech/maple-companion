/** One user-initiated step, cancelled if they navigate elsewhere while it runs. */
export function beginFlowNavigation(doc: Document = document, win: Window = window) {
  const origin = doc.activeElement;
  let cancelled = false;
  let completed = false;
  let frame: number | undefined;
  const interrupt = () => { cancelled = true; };
  const focusChanged = (event: Event) => {
    // Disabling/removing the initiating control may return focus to the body.
    if (event.target !== origin && event.target !== doc.body) interrupt();
  };
  const visibilityChanged = () => { if (doc.visibilityState !== 'visible') interrupt(); };
  const interactions = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
  for (const event of interactions) doc.addEventListener(event, interrupt, { capture: true, passive: true });
  doc.addEventListener('focusin', focusChanged, true);
  doc.addEventListener('visibilitychange', visibilityChanged);
  win.addEventListener('blur', interrupt);
  function cleanup() {
    for (const event of interactions) doc.removeEventListener(event, interrupt, true);
    doc.removeEventListener('focusin', focusChanged, true);
    doc.removeEventListener('visibilitychange', visibilityChanged);
    win.removeEventListener('blur', interrupt);
  }
  function cancel() {
    cancelled = true; cleanup();
    if (frame !== undefined) win.cancelAnimationFrame(frame);
  }
  function complete(targetId?: string) {
    if (completed) return;
    completed = true;
    if (!targetId || cancelled) { cleanup(); return; }
    frame = win.requestAnimationFrame(() => {
      cleanup();
      if (cancelled || doc.visibilityState !== 'visible') return;
      const target = doc.getElementById(targetId);
      if (!target?.isConnected) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start', behavior: win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
  return { complete, cancel };
}

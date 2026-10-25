import { useEffect, useRef } from 'react';

export type WorkspaceNotification = { id: string; operationId: string | null; assessmentId: string | null; kind: 'saved' | 'assessed'; createdAt: string; revision: number };
export function NotificationCenter({ notifications, status }: {
  notifications: WorkspaceNotification[]; status: 'loading' | 'ready' | 'error';
}) {
  const container = useRef<HTMLDetailsElement>(null);
  function close(returnFocus = false) {
    if (!container.current) return;
    container.current.open = false;
    if (returnFocus) container.current.querySelector('summary')?.focus();
  }
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !container.current?.contains(event.target)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && container.current?.open) close(true); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, []);
  return <details className="notification-center" ref={container}>
    <summary aria-label="Your updates" title="Your updates">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      <span className="notification-label">Updates</span>
      {status === 'ready' && notifications.length > 0 && <span className="notification-count" aria-label={`${notifications.length} saved updates`}>{notifications.length}</span>}
    </summary>
    <section className="notification-popover" aria-labelledby="notifications-heading">
      <div className="notification-heading"><h2 id="notifications-heading">Your updates</h2><button type="button" className="text-button" onClick={() => close(true)} aria-label="Close updates">Close</button></div>
      {status === 'loading' ? <p role="status">Checking saved updates…</p> : status === 'error' ? <p role="status">Updates could not be loaded. Use Refresh status to check again.</p> : notifications.length === 0 ? <p className="muted">No saved updates yet. Confirmed changes and completed checks will appear here.</p> : <ul>{notifications.map(item => <li key={item.id}><strong>{item.kind === 'assessed' ? 'Requirement check completed' : 'Employment information saved'}</strong><p>Saved revision {item.revision}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></li>)}</ul>}
      <p className="hint">Pending changes stay in your review list until you confirm them.</p>
    </section>
  </details>;
}

export function GuideSaveActions({ status, busy, blocked, confirm, reconcile, reject, demo = false }: {
  status: string; busy: boolean; blocked: boolean; confirm: () => void; reconcile: () => void; reject: () => void; demo?: boolean;
}) {
  return <div className="actions">{status === 'pending' ? <><button disabled={busy || blocked} onClick={confirm}>{demo ? 'Confirm and save demo profile' : 'Confirm and save Guide details'}</button><button className="secondary" disabled={busy} onClick={reject}>{demo ? 'Discard demo change' : 'Discard Guide change'}</button></> : <><p className="hint">This save needs checking. It will not be sent again.</p><button className="secondary" disabled={busy} onClick={reconcile}>Check save status</button></>}</div>;
}

import type { CrsCalculation, CrsLine } from '../shared/crs.js';
import type { ReactNode } from 'react';

function Lines({ title, rows, total }: { title: string; rows: CrsLine[]; total: number }) {
  return <section><h4>{title}</h4><dl>{rows.length ? rows.map(row => <div key={row.id}><dt>{row.label}</dt><dd>{row.points}</dd></div>) : <div><dt>Not applicable</dt><dd>0</dd></div>}<div className="score-subtotal"><dt>Applied subtotal, after caps</dt><dd><strong>{total}</strong></dd></div></dl></section>;
}

export function CrsBreakdown({ result: r, view = 'all', fictional = true, emphasis = false, qualificationNote, children }: { result: CrsCalculation; view?: 'all' | 'summary' | 'details'; fictional?: boolean; emphasis?: boolean; qualificationNote?: string; children?: ReactNode }) {
  if (r.status !== 'complete') return null;
  return <div className="crs-breakdown">
    {view !== 'details' && <>{emphasis ? <div className="score-impact-figures" aria-label={fictional ? 'Fictional total CRS comparison' : 'Total CRS comparison'}>
      <div className="score-impact-delta"><strong><span className="visually-hidden">Change: </span>{r.delta > 0 ? '+' : ''}{r.delta}</strong><span>CRS points</span></div>
      <div className="score-impact-comparison"><div><span>Previous score</span><strong>{r.before}</strong></div><span className="score-impact-arrow" aria-hidden="true">→</span><div className="score-impact-after"><span>{r.projected ? 'Projected score' : 'Updated score'}</span><strong>{r.after}</strong></div></div>
    </div> : <div className="journey-score" aria-label={fictional ? 'Fictional total CRS comparison' : 'Total CRS comparison'}>
      <span><small>Previous rules</small>{r.before}</span><span className="score-arrow" aria-hidden="true">→</span><span><small>{r.projected ? 'Projected score' : 'Updated score'}</small>{r.after}</span><strong><span className="visually-hidden">Change: </span>{r.delta > 0 ? '+' : ''}{r.delta}<small>points</small></strong>
    </div>}
    <div className="score-context"><p className="score-qualification">{r.projected ? 'Projected' : 'Policy comparison'} · Effective <time dateTime={r.effectiveFrom}>{new Date(r.effectiveFrom + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</time><span>{fictional ? 'Demo profile · ' : ''}Eligibility not established</span></p>{qualificationNote && <p className="score-context-note">{qualificationNote}</p>}</div></>}
    {view !== 'summary' && <details className="score-details"><summary>Review score breakdown</summary>
      <p className="hint">{fictional ? 'Fictional points estimate' : 'Points estimate'} using the same facts and {r.asOf} assessment date. Not a certified score, eligibility decision or invitation prediction.</p>
      <section className="score-change"><h4>What changes: work points {r.labourMarket.workDuration} → {r.labourMarket.selected}</h4>
      <p>{r.labourMarket.selectedAlternative === 'offer' ? 'The qualifying offer alternative is higher and replaces the old work-duration points.' : r.labourMarket.selectedAlternative === 'tie' ? 'The work and qualifying offer alternatives are equal; they are not added together.' : 'Work-duration points plus the eligible high-wage bonus are higher than the offer alternative.'}</p>
      <dl><div><dt>Actual work duration</dt><dd>{r.labourMarket.workDuration}</dd></div><div><dt>Eligible high-wage experience</dt><dd>{r.labourMarket.highWageBonus}</dd></div><div><dt>Combined work alternative</dt><dd>{r.labourMarket.workAlternative}</dd></div><div><dt>Qualifying offer alternative</dt><dd>{r.labourMarket.offerAlternative}</dd></div><div><dt>Higher alternative applied</dt><dd>{r.labourMarket.selected}</dd></div></dl>
      <p className="score-equation">{r.before} − {r.labourMarket.workDuration} + {r.labourMarket.selected} = <strong>{r.after}</strong></p><p>The old work-duration term is replaced, not counted twice. Transferability still uses actual work duration.</p>
      </section><h4>Other points stay the same</h4>
      <div className="score-sections"><Lines title="Other core factors" rows={r.core.filter(row => row.id !== 'canadian_work')} total={r.totals.core - r.labourMarket.workDuration} /><Lines title="Spouse factors" rows={r.spouse} total={r.totals.spouse} /><Lines title="Transferability" rows={r.transferability} total={r.totals.transferability} /><Lines title="Additional points" rows={r.additional} total={r.totals.additional} /></div>
      <p className="hint">Calculator {r.policyVersion}. Reviewed source versions are listed with the official sources. Raw factor sums may exceed a category cap; only the applied subtotal enters the total.</p>
      {children}
    </details>}
  </div>;
}

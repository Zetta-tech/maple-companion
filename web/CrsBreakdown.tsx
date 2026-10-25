import type {CrsCalculation,CrsLine} from '../shared/crs.js';
function Lines({title,rows,total}:{title:string;rows:CrsLine[];total:number}){
  return <section><h4>{title}</h4><dl>{rows.length?rows.map(row=><div key={row.id}><dt>{row.label}</dt><dd>{row.points}</dd></div>):<div><dt>Not applicable</dt><dd>0</dd></div>}<div><dt>Applied subtotal, after caps</dt><dd><strong>{total}</strong></dd></div></dl></section>;
}
export function CrsBreakdown({result:r}:{result:CrsCalculation}){
  if(r.status!=='complete')return null;
  return <div className="crs-breakdown"><p className="eyebrow">Complete fictional points estimate · {r.asOf}</p>
    <div className="journey-score" aria-label="Fictional total CRS comparison"><span><small>Pre-November rules</small>{r.before}</span><span aria-hidden="true">→</span><span><small>Announced rules</small>{r.after}</span><strong>{r.delta>=0?'+':''}{r.delta}</strong></div>
    <p className="hint">{r.projected?'Future projection':'Policy comparison'} · Effective {r.effectiveFrom}. Same facts and date on both sides. Not a certified score, eligibility decision or invitation prediction.</p>
    <details><summary>Inspect the complete score breakdown</summary><Lines title="Core factors under the old rules" rows={r.core} total={r.totals.core}/><Lines title="Spouse factors" rows={r.spouse} total={r.totals.spouse}/><Lines title="Transferability" rows={r.transferability} total={r.totals.transferability}/><Lines title="Additional points" rows={r.additional} total={r.totals.additional}/>
      <h4>Announced Labour Market Integration comparison</h4><dl><div><dt>Actual work duration</dt><dd>{r.labourMarket.workDuration}</dd></div><div><dt>Eligible high-wage experience</dt><dd>{r.labourMarket.highWageBonus}</dd></div><div><dt>Combined work alternative</dt><dd>{r.labourMarket.workAlternative}</dd></div><div><dt>Qualifying offer alternative</dt><dd>{r.labourMarket.offerAlternative}</dd></div><div><dt>Higher alternative applied</dt><dd>{r.labourMarket.selected}</dd></div></dl>
      <p>{r.before} − {r.labourMarket.workDuration} + {r.labourMarket.selected} = <strong>{r.after}</strong>. The old work-duration term is replaced, not counted twice. Transferability still uses actual work duration.</p>
      <p className="hint">Calculator {r.policyVersion}. Reviewed source versions are listed below. Raw factor sums may exceed a category cap; only the applied subtotal enters the total.</p>
    </details></div>;
}

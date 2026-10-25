import type { CecWorkEvidence } from '../shared/cec-evidence.js';

type Answer = CecWorkEvidence['paid'];
export const cecFieldLabels: ReadonlyArray<[keyof CecWorkEvidence, string]> = [
  ['startDate', 'Interval first day'], ['ongoing', 'Interval ongoing'], ['endDate', 'Interval actual last day'],
  ['hoursPerWeek', 'Weekly hours throughout interval'], ['singleIntervalComplete', 'Complete single-interval history'],
  ['conditionsConsistent', 'Consistent hours and conditions'], ['physicallyInCanada', 'Physically in Canada'],
  ['authorizedTemporaryResident', 'Authorized work under temporary resident status'], ['paid', 'Paid wages or commission'],
  ['relationship', 'Employment relationship'], ['physicianException', 'Physician exception may apply'],
  ['fullTimeStudy', 'Any full-time study'], ['workArrangement', 'Work arrangement'],
  ['canadianEmployer', 'Canadian employer'], ['nocDutiesMatch', 'NOC lead statement and main duties match'],
  ['nocEssentialDutiesMatch', 'All essential NOC duties performed'],
];
export function blankCecEvidence(): CecWorkEvidence {
  return { startDate: '', ongoing: false, endDate: null, hoursPerWeek: null, singleIntervalComplete: 'unknown',
    conditionsConsistent: 'unknown', physicallyInCanada: 'unknown', authorizedTemporaryResident: 'unknown', paid: 'unknown',
    relationship: 'unknown', physicianException: 'unknown', fullTimeStudy: 'unknown', workArrangement: 'unknown',
    canadianEmployer: 'unknown', nocDutiesMatch: 'unknown', nocEssentialDutiesMatch: 'unknown' };
}
function AnswerField({ label, value, change }: { label: string; value: Answer; change: (value: Answer) => void }) {
  return <label>{label}<select value={value} onChange={event => change(event.target.value as Answer)}>
    <option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option><option value="not_applicable">Not applicable</option>
  </select></label>;
}
export function CecWorkFields({ value, onChange, jobStartDate }: { value?: CecWorkEvidence; onChange: (value: CecWorkEvidence | undefined) => void; jobStartDate?: string }) {
  const update = <K extends keyof CecWorkEvidence,>(field: K, next: CecWorkEvidence[K]) => { if (value) onChange({ ...value, [field]: next }); };
  const startsBeforeJob = !!(value?.startDate && jobStartDate && value.startDate < jobStartDate);
  return <details className="noc-details"><summary>Evidence for a CEC work-experience check</summary>
    <p className="hint">Record one interval in this job with consistent hours and conditions. Current hours alone do not establish past work. A reviewed rule is still required before a check can run.</p>
    <label className="checkbox"><input type="checkbox" checked={value !== undefined} onChange={event => onChange(event.target.checked ? blankCecEvidence() : undefined)} /><span>Include an interval for review</span></label>
    {value && <>
      <div className="field-grid"><label>Interval first day<input type="date" required value={value.startDate} min={jobStartDate || undefined} aria-invalid={startsBeforeJob} aria-describedby={startsBeforeJob ? 'cec-start-error' : undefined} onChange={event => update('startDate', event.target.value)} />{startsBeforeJob && <span id="cec-start-error" role="alert">This interval cannot begin before the job's start date ({jobStartDate}). Correct the interval, or review the job start date above.</span>}</label>
        <label>Weekly hours throughout this interval<input type="number" min="0.01" max="168" step="any" value={value.hoursPerWeek ?? ''} onChange={event => update('hoursPerWeek', event.target.value === '' ? null : Number(event.target.value))} /><span className="hint">Leave blank if unknown. Do not use today’s hours for a different past schedule.</span></label></div>
      <label className="checkbox"><input type="checkbox" checked={value.ongoing} onChange={event => onChange({ ...value, ongoing: event.target.checked, endDate: null })} /><span>This interval is still ongoing</span></label>
      {!value.ongoing && <label>Actual last day<input type="date" required value={value.endDate ?? ''} onChange={event => update('endDate', event.target.value || null)} /></label>}
      <div className="field-grid">
        <AnswerField label="Does this one interval cover all work to consider, with no gaps, other periods or concurrent jobs?" value={value.singleIntervalComplete} change={next => update('singleIntervalComplete', next)} />
        <AnswerField label="Were the hours and all answers below consistent throughout this interval?" value={value.conditionsConsistent} change={next => update('conditionsConsistent', next)} />
        <AnswerField label="Were you physically in Canada throughout this interval?" value={value.physicallyInCanada} change={next => update('physicallyInCanada', next)} />
        <AnswerField label="Were you authorized to work under temporary resident status throughout this interval?" value={value.authorizedTemporaryResident} change={next => update('authorizedTemporaryResident', next)} />
        <AnswerField label="Were you paid wages or commission throughout this interval?" value={value.paid} change={next => update('paid', next)} />
        <AnswerField label="Did any part of the interval overlap full-time study, including co-op?" value={value.fullTimeStudy} change={next => update('fullTimeStudy', next)} />
        <label>Employment relationship<select value={value.relationship} onChange={event => update('relationship', event.target.value as CecWorkEvidence['relationship'])}><option value="unknown">Unknown</option><option value="employee">Employee</option><option value="self_employed">Self-employed</option><option value="not_applicable">Not applicable</option></select></label>
        {value.relationship === 'self_employed' && <AnswerField label="Could the physician self-employment exception apply?" value={value.physicianException} change={next => update('physicianException', next)} />}
        <label>Work arrangement<select value={value.workArrangement} onChange={event => update('workArrangement', event.target.value as CecWorkEvidence['workArrangement'])}><option value="unknown">Unknown</option><option value="onsite">Onsite</option><option value="remote">Remote</option><option value="mixed">Mixed</option><option value="not_applicable">Not applicable</option></select></label>
        <AnswerField label="Was the employer Canadian? (required for remote or mixed work)" value={value.canadianEmployer} change={next => update('canadianEmployer', next)} />
        <AnswerField label="For this interval, did you perform the selected NOC’s lead-statement actions and most main duties?" value={value.nocDutiesMatch} change={next => update('nocDutiesMatch', next)} />
        <AnswerField label="Did you perform all essential duties of that NOC throughout this interval?" value={value.nocEssentialDutiesMatch ?? 'unknown'} change={next => update('nocEssentialDutiesMatch', next)} />
      </div><p className="hint">Unknown and not applicable remain distinct. Complex history and physician exceptions need separate review. These answers will be included in the exact change you confirm.</p>
    </>}
  </details>;
}
export function displayCecValue(value: CecWorkEvidence | undefined, field: keyof CecWorkEvidence): string {
  if (!value) return 'Not recorded';
  if (field === 'endDate' && value.ongoing) return 'None — ongoing interval';
  const answer = value[field];
  if (answer === undefined) return 'Not recorded';
  if (answer === null || answer === '') return 'Unknown';
  if (typeof answer === 'boolean') return answer ? 'Yes' : 'No';
  return String(answer).replaceAll('_', ' ');
}
export function CecWorkReview({ oldValue, newValue }: { oldValue?: CecWorkEvidence; newValue?: CecWorkEvidence }) {
  if (!oldValue && !newValue) return null;
  return <div className="comparison" aria-label="CEC interval evidence comparison"><h3>Work interval evidence</h3>
    {cecFieldLabels.map(([field, label]) => <div className={`comparison-row${displayCecValue(oldValue, field) !== displayCecValue(newValue, field) ? ' changed' : ''}`} key={field}>
      <strong>{label}</strong><div><span className="mobile-label">Currently saved</span>{displayCecValue(oldValue, field)}</div><div><span className="mobile-label">Proposed</span>{displayCecValue(newValue, field)}</div>
    </div>)}
  </div>;
}

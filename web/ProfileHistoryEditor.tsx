import type { PersonalIntake } from '../shared/personal-guide.js';
import { emptyProfileHistory } from '../shared/profile-history.js';
import { emptyCrsEvidence, type LanguageEvidence } from '../shared/crs.js';
import { CrsEvidenceEditor, Language } from './CrsEvidenceEditor.js';
import type { ProfileSection } from './profile-navigation.js';

type Props = { section:ProfileSection; value:PersonalIntake; onChange:(next:PersonalIntake)=>void; date:string; employmentEndDate:string|null };
export function ProfileHistoryEditor({ section, value, onChange, date, employmentEndDate }:Props) {
  const history = value.history ?? emptyProfileHistory();
  const set = (update:Partial<PersonalIntake>) => onChange({ ...value, ...update });
  const updateEducation = (id:string, update:Partial<typeof history.education[number]>) => set({ history:{ ...history, education:history.education.map(record => record.id === id ? { ...record, ...update } : record) } });
  const updateTest = (id:string, update:Partial<typeof history.languageTests[number]>) => set({ history:{ ...history, languageTests:history.languageTests.map(record => record.id === id ? { ...record, ...update } : record) } });
  const useTest = (language:'english'|'french', test:LanguageEvidence) => {
    const { status, test:testName, date:testDate, reading, writing, listening, speaking, benchmarkConversionReviewed } = test;
    const evidence = value.crsEvidence ?? emptyCrsEvidence(date, employmentEndDate);
    set({ crsEvidence:{ ...evidence, [language]:{ status, test:testName, date:testDate, reading, writing, listening, speaking, benchmarkConversionReviewed }, completeEvidenceReviewed:'unknown' } });
  };
  if (section === 'education') return <>
    <p className="profile-note">Add the credentials you want to keep in your history. Names and study dates do not establish Canadian equivalency; review that separately in assessment evidence.</p>
    {history.education.map((record, index) => <section className="profile-record-editor" key={record.id} aria-label={`Education ${index + 1}`}>
      <div className="profile-record-heading"><h3>{record.program || `Education ${index + 1}`}</h3><button type="button" className="secondary" onClick={() => set({history:{...history,education:history.education.filter(item => item.id !== record.id)}})} aria-label={`Remove education ${index + 1} from draft`}>Remove</button></div>
      <div className="field-grid"><label>Institution<input required maxLength={200} value={record.institution} onChange={event => updateEducation(record.id,{institution:event.target.value})}/></label><label>Program or field of study<input required maxLength={200} value={record.program} onChange={event => updateEducation(record.id,{program:event.target.value})}/></label></div>
      <label>Credential name <span className="optional">(optional)</span><input maxLength={200} value={record.credential} onChange={event => updateEducation(record.id,{credential:event.target.value})}/></label>
      <div className="field-grid"><label>Start date <span className="optional">(if known)</span><input type="date" value={record.startDate ?? ''} onChange={event => updateEducation(record.id,{startDate:event.target.value || null})}/></label><label>Completion date <span className="optional">(if known)</span><input type="date" value={record.endDate ?? ''} min={record.startDate || undefined} onChange={event => updateEducation(record.id,{endDate:event.target.value || null})}/></label></div>
      <label>Notes <span className="optional">(optional)</span><textarea rows={2} maxLength={500} value={record.notes} onChange={event => updateEducation(record.id,{notes:event.target.value})}/></label>
    </section>)}
    <button type="button" className="secondary" disabled={history.education.length >= 20} onClick={() => set({ history:{...history,education:[...history.education,{id:crypto.randomUUID(),institution:'',program:'',credential:'',startDate:null,endDate:null,notes:''}]} })}>Add education</button>
  </>;
  if (section === 'languages') return <>
    <p className="profile-note">Keep each test separately. Enter the four CLB/NCLC benchmarks from reviewed conversions; leave unverified numbers blank. History does not automatically replace the evidence used for scoring.</p>
    {history.languageTests.map((record,index) => <section className="profile-record-editor" key={record.id} aria-label={`Language test ${index + 1}`}>
      <div className="profile-record-heading"><h3>{record.test || `Language test ${index + 1}`}</h3><button type="button" className="secondary" onClick={() => set({history:{...history,languageTests:history.languageTests.filter(item => item.id !== record.id)}})} aria-label={`Remove language test ${index + 1} from draft`}>Remove</button></div>
      <label>Test language<select value={record.language} onChange={event => updateTest(record.id,{language:event.target.value as 'english'|'french',test:null,benchmarkConversionReviewed:'unknown'})}><option value="english">English</option><option value="french">French</option></select></label>
      <Language label={`Test ${index + 1}`} name={record.language} value={record} onChange={next => updateTest(record.id,next)}/>
      <label>Notes <span className="optional">(optional)</span><textarea rows={2} maxLength={500} value={record.notes} onChange={event => updateTest(record.id,{notes:event.target.value})}/></label>
      <button type="button" className="secondary" onClick={() => useTest(record.language,record)}>Use as current {record.language === 'english' ? 'English' : 'French'} evidence</button>
      <p className="profile-note">This updates your draft assessment inputs. Review and confirm the complete change before it is saved.</p>
    </section>)}
    <button type="button" className="secondary" disabled={history.languageTests.length >= 20} onClick={() => set({history:{...history,languageTests:[...history.languageTests,{id:crypto.randomUUID(),language:'english',status:'tested',test:null,date:null,reading:null,writing:null,listening:null,speaking:null,benchmarkConversionReviewed:'unknown',notes:''}]}})}>Add a language test</button>
    {!history.languageTests.length && value.crsEvidence && <p className="profile-note">Your existing current-language evidence is still saved under assessment evidence.</p>}
  </>;
  if (section === 'status') return <>
    <label>Name <span className="optional">(optional)</span><input maxLength={80} value={value.name ?? ''} onChange={event => set({name:event.target.value || null})}/></label>
    <div className="field-grid"><label>Arrival in Canada <span className="optional">(if known)</span><input type="date" value={value.arrivedInCanada ?? ''} onChange={event => set({arrivedInCanada:event.target.value || null})}/></label><label>Permit expiry <span className="optional">(if known)</span><input type="date" value={value.permitExpiry ?? ''} onChange={event => set({permitExpiry:event.target.value || null})}/></label></div>
    <label>Current immigration status is valid<select value={value.currentStatusValid} onChange={event => set({currentStatusValid:event.target.value as PersonalIntake['currentStatusValid']})}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></label>
    <p className="profile-note">Unknown dates stay unknown. Travel, address and permit-document histories are not stored here yet.</p>
  </>;
  return <>
    <div className="field-grid">{([['canadianOffer','Canadian job offer'],['reciprocalProgramReported','Employer exchange program reported'],['employerPortalOffer','Employer Portal offer submitted']] as const).map(([field,label]) => <label key={field}>{label}<select value={value[field]} onChange={event => set({[field]:event.target.value as 'yes'|'no'|'unknown'})}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></label>)}</div>
    <label>Evidence for the employer exchange program<select value={value.reciprocalEvidence} onChange={event => set({reciprocalEvidence:event.target.value as PersonalIntake['reciprocalEvidence']})}><option value="unknown">Unknown</option><option value="not_requested">Not requested</option><option value="promised">Supporting documents promised</option><option value="documents_available">Documents available for review</option></select></label>
    <label>Qualifying Express Entry offer review<select value={value.qualifyingExpressEntryOffer} onChange={event => set({qualifyingExpressEntryOffer:event.target.value as PersonalIntake['qualifyingExpressEntryOffer']})}><option value="not_reviewed">Not reviewed</option><option value="none_reviewed">Reviewed: no qualifying offer</option><option value="reviewed_offer">Qualifying offer reviewed in CRS evidence</option></select></label>
    <div className="profile-family-fields field-grid"><label>Accompanying spouse<select value={value.spouseAccompanying} onChange={event => set({spouseAccompanying:event.target.value as PersonalIntake['spouseAccompanying']})}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></label><label>Spouse permit expiry <span className="optional">(if known)</span><input type="date" value={value.spousePermitExpiry ?? ''} onChange={event => set({spousePermitExpiry:event.target.value || null})}/></label></div>
    <CrsEvidenceEditor value={value.crsEvidence} asOf={date} spouseAccompanying={value.spouseAccompanying} fictional={false} employmentEndDate={employmentEndDate} onChange={next => { const updated={...value}; if(next)updated.crsEvidence=next;else delete updated.crsEvidence;onChange(updated); }}/>
  </>;
}

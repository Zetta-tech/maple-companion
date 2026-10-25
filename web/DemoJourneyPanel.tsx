import { useCallback,useEffect,useState,type FormEvent } from 'react';
import { demoProfileSchema,type DemoProfile,type DemoSnapshot,type JourneyEvent,type Discovery } from '../shared/demo.js';
import { businessDate } from '../shared/business-date.js';
import { watchAssessmentRefresh } from './assessment-refresh.js';
import { guideQuestionSchema,guideRequestNotSent } from '../shared/guide-request.js';
import {CrsEvidenceEditor} from './CrsEvidenceEditor.js';
import {CrsBreakdown} from './CrsBreakdown.js';
import {CRS_POLICY_VERSION} from '../shared/crs.js';
import './DemoJourneyPanel.css';
type Request=<T>(path:string,body?:unknown)=>Promise<T>;
type Proposal={id:string;status:string;profile:DemoProfile|null;baseRevision:number};
function Finding({discovery:d}: {discovery:Discovery}) {
  return <><p className="eyebrow">{d.status==='potential_pathway'?'A possibility to investigate':d.kind==='express_entry'?'Official policy development':'More information needed'}</p>
    <h3>{d.title}</h3><p>{d.summary}</p>{d.score&&<div className="journey-score" aria-label="Canadian work component comparison"><span><small>Before</small>{d.score.before}</span><span aria-hidden="true">→</span><span><small>Projected component</small>{d.score.after}</span><strong>+{d.score.delta}</strong></div>}
    {d.score&&<p className="hint">Canadian-work component only · Effective {d.score.effectiveFrom} · Total CRS not calculated{d.score.conditional?' · Offer comparison unresolved':''}</p>}
    {d.crs&&<CrsBreakdown result={d.crs}/>}
    <details><summary>Why this matters to your profile</summary><ul>{d.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></details>
    <details><summary>What still needs checking ({d.outstanding.length})</summary><ul>{d.outstanding.map(item=><li key={item}>{item}</li>)}</ul></details>
    <details><summary>Next steps and official sources</summary><ol>{d.nextSteps.map(item=><li key={item}>{item}</li>)}</ol><ul>{d.sources.map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><small> Checked {new Date(source.retrievedAt).toLocaleString()}</small></li>)}</ul></details>
  </>;
}
function Explanation({event}: {event:JourneyEvent}) {
  if(event.explanationStatus==='withheld')return <p className="notice" role="status">The generated explanation could not be checked against the reviewed conditions and sources, so it is not shown. The condition checks and official sources remain available above.</p>;
  if(!event.reply)return null;
  return <details className="guide-explanation"><summary>Saved generated explanation</summary><p>{event.reply}</p><p className="hint">Generated explanation, not verified immigration advice. Source and condition checks do not prove every sentence is correct. Use the dated conditions and official guidance above; this text does not authorize work or establish eligibility.</p></details>;
}
export function JourneyCard({event,revision,date=businessDate(new Date())}: {event:JourneyEvent;revision:number;date?:string}) {
  const stale=!!event.calculatorVersion&&event.calculatorVersion!==CRS_POLICY_VERSION||event.profileRevision!==revision||event.discovery&&event.discovery.assessmentDate!==date||event.discovery?.crs?.status==='complete'&&event.discovery.crs.policyVersion!==CRS_POLICY_VERSION;
  return <article className="journey-card"><p className="hint">{event.kind==='policy_update'?'Personalized policy update':'Work-pathway discovery'} · <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>{event.replay?' · Developer-triggered replay of a real announcement':''}</p>
    {event.status!=='completed'?<p role="status">{event.status==='not_sent'?'No conversation request was sent. You can try again after the connection is checked.':event.status==='processing'?'This request is still being checked.':'This request could not be completed reliably. It has not been retried automatically. An operator must check its recorded outcome before another request; refreshing alone does not resolve it.'}</p>
      :stale?<><h3>Saved journey item</h3><p>Your profile, assessment date or calculator version changed. This historical item is not a current assessment.</p><details><summary>View the dated result</summary>{event.discovery&&<Finding discovery={event.discovery}/>}<Explanation event={event}/></details></>
      :<>{event.discovery&&<Finding discovery={event.discovery}/>}<Explanation event={event}/></>}
  </article>;
}
const answerFields:ReadonlyArray<[keyof DemoProfile,string]>=[['currentStatusValid','Current immigration status is valid'],['canadianOffer','Canadian employment offer exists'],['reciprocalProgramReported','HR reports reciprocal opportunities abroad for Canadians or permanent residents'],['employerPortalOffer','Employer Portal offer is already submitted'],['spouseAccompanying','Spouse is accompanying'],['physicallyCanada','Work was physically in Canada throughout'],['authorizedWork','Work was authorized throughout'],['paidEmployee','Paid employee throughout'],['fullTimeStudy','Any full-time study during this work'],['selfEmployed','Any self-employment during this work']];
export function DemoJourneyPanel({request}:{request:Request}) {
  const [available,setAvailable]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [snapshot,setSnapshot]=useState<DemoSnapshot|null>(null),[draft,setDraft]=useState<DemoProfile|null>(null),[pending,setPending]=useState<Proposal[]>([]),[events,setEvents]=useState<JourneyEvent[]>([]);
  const [question,setQuestion]=useState('My spouse and I want to keep working in Canada as our permits approach expiry. What should we investigate with my employer?');
  const [requestPending,setRequestPending]=useState<string|null>(null);
  const [date,setDate]=useState(()=>businessDate(new Date()));
  useEffect(()=>watchAssessmentRefresh(()=>setDate(businessDate(new Date())),window,document),[]);
  const refresh=useCallback(async(reset=false)=>{
    const status=await request<{available:boolean}>('/api/demo/status');setAvailable(status.available);if(!status.available)return;
    setSnapshot(null);
    const [profileResult,proposals,journey]=await Promise.allSettled([request<DemoSnapshot>('/api/demo/profile'),request<{proposals:Proposal[]}>('/api/demo/proposals'),request<{events:JourneyEvent[]}>('/api/demo/journey')]);
    // Pending/uncertain operation metadata must remain visible even when AM readback fails.
    if(proposals.status==='fulfilled')setPending(proposals.value.proposals);
    if(journey.status==='fulfilled'){setEvents(journey.value.events);setRequestPending(current=>current&&journey.value.events.some(e=>e.id===current&&['completed','not_sent'].includes(e.status))?null:current);}
    if(profileResult.status==='rejected')throw profileResult.reason;
    if(proposals.status==='rejected')throw proposals.reason;
    if(journey.status==='rejected')throw journey.reason;
    const profile=profileResult.value;setSnapshot(profile);
    if(reset||!draft){if(profile.profile)setDraft(profile.profile);else setDraft((await request<{profile:DemoProfile}>('/api/demo/seed')).profile);}
  },[request,draft]);
  useEffect(()=>{let alive=true;void request<{available:boolean}>('/api/demo/status').then(async s=>{if(!alive)return;setAvailable(s.available);if(s.available)await refresh(true);}).catch(e=>alive&&setError(e.message));return()=>{alive=false;};},[request]);
  async function act(run:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await run();}catch(e){setError(e instanceof Error?e.message:'This request could not be verified.');}finally{setBusy(false);}}
  async function propose(event:FormEvent){event.preventDefault();if(!draft||!snapshot)return;await act(async()=>{
    const parsed=demoProfileSchema.safeParse(draft);if(!parsed.success)throw Error('Review the demonstration dates, duties and profile fields.');
    const result=await request<Proposal>('/api/demo/proposals',{baseRevision:snapshot.revision,profile:parsed.data});setPending([result]);setNotice('Review this exact fictional profile before saving it to memory.');
  });}
  async function confirm(proposal:Proposal){await act(async()=>{await request(`/api/demo/proposals/${proposal.id}/confirm`,{confirm:true});await refresh(true);setNotice('The fictional profile was saved and read back from memory.');});}
  async function research(kind:'discover'|'policy-replay'){await act(async()=>{
    if(kind==='discover'&&!guideQuestionSchema.safeParse(question).success)throw Error('Enter a question between 1 and 2,000 characters. Nothing was sent.');
    const id=crypto.randomUUID();setRequestPending(id);
    let result:JourneyEvent;
    try{result=await request<JourneyEvent>('/api/demo/'+kind,{requestId:id,fictional:true,...(kind==='discover'?{question}:{})});}
    catch(reason){
      // These source checks run before claiming an event or calling AM. A user may retry
      // explicitly; transport errors and uncertain outcomes keep the no-resubmit hold.
      const code=reason&&typeof reason==='object'&&'code' in reason?reason.code:null;
      if(guideRequestNotSent(code))setRequestPending(null);
      throw reason;
    }
    setEvents(current=>[result,...current.filter(e=>e.id!==result.id)]);setRequestPending(null);setNotice('Saved to your private demonstration journey.');
  });}
  if(!available)return null;
  const blocked=busy||pending.length>0||!!requestPending||events.some(e=>['processing','uncertain'].includes(e.status));
  return <section className="demo-journey" aria-labelledby="journey-title"><div className="journey-intro"><p className="eyebrow">Maple Guide · Fictional demonstration</p><h2 id="journey-title">Find your next possibility.</h2><p>A dedicated demo profile, real official sources and a private journey you can return to. Your employment assessment inputs are not changed here.</p></div>
    {error&&<p className="notice error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
    <div className="journey-toolbar"><span>{snapshot?.profile?`${snapshot.profile.name} · Verified demo revision ${snapshot.revision}`:'Review the fictional starting profile to begin'}</span><button className="secondary" disabled={busy} onClick={()=>void act(()=>refresh())}>Refresh journey</button></div>
    {draft&&<details className="demo-profile" open={!snapshot?.profile}><summary>{snapshot?.profile?'Review or edit demonstration profile':'Review fictional demonstration profile'}</summary><p className="hint">All details below—including HR’s reported program—are invented for this demonstration. They are not evidence about a real employer.</p><form onSubmit={propose}><fieldset disabled={busy||pending.length>0}><legend className="visually-hidden">Fictional profile</legend>
      <div className="field-grid">{([['name','Demo name'],['employer','Fictional employer'],['jobTitle','Job title'],['noc','Reviewed NOC']] as const).map(([field,label])=><label key={field}>{label}<input required value={draft[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})}/></label>)}</div>
      <div className="field-grid">{([['arrivedInCanada','Arrival in Canada'],['permitExpiry','Your work permit expiry'],['spousePermitExpiry','Spouse work permit expiry'],['workStart','Consistent Canadian work began']] as const).map(([field,label])=><label key={field}>{label}<input type="date" required={field!=='spousePermitExpiry'} value={draft[field]??''} onChange={e=>setDraft({...draft,[field]:e.target.value||null})}/></label>)}</div>
      <label>Weekly hours<input type="number" min="0.01" max="168" step="any" value={draft.weeklyHours} onChange={e=>setDraft({...draft,weeklyHours:Number(e.target.value)})}/></label>
      <label>Actual fictional duties<textarea value={draft.duties} onChange={e=>setDraft({...draft,duties:e.target.value})}/></label><label className="checkbox"><input type="checkbox" checked={draft.nocReviewed} onChange={e=>setDraft({...draft,nocReviewed:e.target.checked})}/>I reviewed the fictional duties against the NOC.</label>
      <div className="field-grid">{answerFields.map(([field,label])=><label key={field}>{label}<select value={String(draft[field])} onChange={e=>setDraft({...draft,[field]:e.target.value})}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></label>)}</div>
      <label>Reciprocity documents<select value={draft.reciprocalEvidence} onChange={e=>setDraft({...draft,reciprocalEvidence:e.target.value as DemoProfile['reciprocalEvidence']})}><option value="unknown">Unknown</option><option value="not_requested">Not requested</option><option value="promised">HR has promised supporting documents</option><option value="documents_available">Documents available for review</option></select></label>
      <label>Qualifying Express Entry offer assessment<select value={draft.qualifyingExpressEntryOffer} onChange={e=>setDraft({...draft,qualifyingExpressEntryOffer:e.target.value as DemoProfile['qualifyingExpressEntryOffer']})}><option value="not_reviewed">Not reviewed</option><option value="none_reviewed">This fictional scenario has no qualifying Express Entry offer</option><option value="reviewed_offer">Qualifying offer reviewed in the CRS evidence section</option></select></label>
      <CrsEvidenceEditor value={draft.crsEvidence} asOf={date} spouseAccompanying={draft.spouseAccompanying} onChange={crsEvidence=>{const next={...draft};if(crsEvidence)next.crsEvidence=crsEvidence;else delete next.crsEvidence;setDraft(next);}}/><button type="submit">Review demo profile</button></fieldset></form></details>}
    {pending.map(proposal=><section className="review" key={proposal.id}><h3>Confirm this fictional profile</h3><p>This saves only the designated demonstration entity in memory. It does not replace your ordinary employment record.</p>{proposal.profile&&<details open><summary>Exact values to save</summary><dl className="demo-review">{Object.entries(proposal.profile).map(([field,value])=><div key={field}><dt>{field.replace(/([A-Z])/g,' $1')}</dt><dd>{value!==null&&typeof value==='object'?<pre>{JSON.stringify(value,null,2)}</pre>:String(value??'Not recorded')}</dd></div>)}</dl></details>}<button disabled={busy||proposal.status!=='pending'} onClick={()=>void confirm(proposal)}>{proposal.status==='pending'?'Confirm and save demo profile':'Save outcome needs checking — do not resubmit'}</button>{proposal.status==='pending'&&<button className="secondary" disabled={busy} onClick={()=>void act(async()=>{await request('/api/demo/proposals/'+proposal.id+'/reject',{});await refresh();})}>Discard demo change</button>}</section>)}
    <div className="guide-prompt"><label htmlFor="guide-question">What would you like to understand?</label><textarea id="guide-question" maxLength={2000} aria-describedby="guide-question-help" value={question} onChange={e=>setQuestion(e.target.value)} disabled={blocked||!snapshot?.profile}/><button disabled={blocked||!snapshot?.profile||!question.trim()} onClick={()=>void research('discover')}>{busy?'Checking sources and memory…':'Explore work options'}</button><p className="hint" id="guide-question-help">Up to 2,000 characters. This first guide experience researches reciprocal employment. It is not a complete search of every immigration pathway.</p></div>
    <div className="journey-results" aria-live="polite">{events.length?events.map(event=><JourneyCard key={event.id} event={event} revision={snapshot?.revision??0} date={date}/>):<p>Your discoveries and policy updates will appear here after the real workflow completes.</p>}</div>
    <details className="demo-replay"><summary>Demo controls: official policy replay</summary><p>Process the real October 16 Express Entry announcement against the same saved profile. On October 25, the November 3 change is future policy. This records a component comparison, or a complete fictional points estimate only when every CRS factor has been reviewed.</p><button className="secondary" disabled={blocked||!snapshot?.profile} onClick={()=>void research('policy-replay')}>Process official Express Entry update</button></details>
  </section>;
}

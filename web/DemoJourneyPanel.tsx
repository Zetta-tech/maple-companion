import { useCallback,useEffect,useState,type FormEvent } from 'react';
import { demoProfileSchema,type DemoProfile,type DemoSnapshot,type JourneyEvent,type Discovery } from '../shared/demo.js';
import { businessDate } from '../shared/business-date.js';
import { watchAssessmentRefresh } from './assessment-refresh.js';
import { guideQuestionSchema,guideRequestNotSent } from '../shared/guide-request.js';
import {CrsEvidenceEditor} from './CrsEvidenceEditor.js';
import {CrsBreakdown} from './CrsBreakdown.js';
import { findingHeading, findingLabel, findingReason, isJourneyStale, splitJourney } from './journey-presentation.js';
import { useFlowNavigation } from './useFlowNavigation.js';
import { GuideSaveActions } from './GuideSaveActions.js';
import { ScoreImpact } from './ScoreImpact.js';
import { DiscoveryEvidence } from './DiscoveryEvidence.js';
import './DemoJourneyPanel.css';
type Request=<T>(path:string,body?:unknown)=>Promise<T>;
type Proposal={id:string;status:string;profile:DemoProfile|null;baseRevision:number};
function Finding({ discovery: d, fictional = true }: { discovery: Discovery; fictional?: boolean }) {
  const crs = d.crs?.status === 'complete' ? d.crs : null;
  const why = findingReason(d);
  const qualification = d.status === 'potential_pathway' && d.outstanding[0]?.startsWith('Obtain the employer')
    ? 'Employer exchange evidence still needs review.'
    : d.outstanding[0];
  return <>
    {crs ? <ScoreImpact discovery={d} fictional={fictional} /> : <>
    <div className={`finding-overview finding-overview--${d.kind}`}><div className="finding-outcome">
    <h3>{findingHeading(d)}</h3>
    {d.crs && <CrsBreakdown result={d.crs} view="summary" fictional={fictional} />}
    {d.kind === 'c20' && <p className="finding-relevance">{why}</p>}
    {d.kind === 'c20' && <p className="result-qualification"><strong>{d.status === 'potential_pathway' ? 'Potential pathway · Eligibility not established' : 'Employer evidence still needs review'}</strong><span>{qualification ?? 'Review the official requirements before relying on this result.'}</span></p>}
    {d.score && <><div className="journey-score" aria-label="Canadian work component comparison"><span><small>Previous component</small>{d.score.before}</span><span className="score-arrow" aria-hidden="true">→</span><span><small>Projected component</small>{d.score.after}</span><strong>{d.score.delta > 0 ? '+' : ''}{d.score.delta}<small>points</small></strong></div><p className="result-qualification"><strong>Component only · Effective {d.score.effectiveFrom}</strong><span>Total CRS not calculated.{d.score.conditional && ' Qualifying-offer comparison is unresolved; the final difference may differ.'}</span></p></>}
    </div><div className="finding-action">{d.kind !== 'c20' && <p className="finding-relevance">{why}</p>}
    {d.nextSteps[0] && <div className="finding-next"><h4>Your next step</h4><p>{d.nextSteps[0]}</p></div>}</div></div>
    {d.kind === 'express_entry' && d.outstanding[0] && <p className="result-qualification"><strong>Still to verify</strong><span>{crs && d.outstanding[0].startsWith('The overall maximum under the announced allocation remains unresolved') ? 'The overall policy cap remains unresolved. This projection stays below the disputed boundary; higher-score cases are withheld.' : d.outstanding[0]}</span></p>}
    </>}
    {!crs && <div className="finding-details"><details><summary>Review evidence and official sources</summary><DiscoveryEvidence discovery={d} /></details></div>}
  </>;
}
function Explanation({ event }: { event: JourneyEvent }) {
  if (event.explanationStatus === 'withheld') return <p className="notice" role="status">The generated explanation could not be checked against the reviewed conditions and sources, so it is not shown. The condition checks and official sources remain available above.</p>;
  if (!event.reply) return null;
  return <details className="guide-explanation"><summary>Saved generated explanation</summary><p>{event.reply}</p><p className="hint">Generated explanation, not verified immigration advice. Source and condition checks do not prove every sentence is correct. Use the dated conditions and official guidance above; this text does not authorize work or establish eligibility.</p></details>;
}
export function JourneyCard({ event, revision, date = businessDate(new Date()), fictional = true }: { event: JourneyEvent; revision: number | null; date?: string; fictional?: boolean }) {
  const stale = isJourneyStale(event, revision, date);
  const state = event.status === 'processing' ? 'Still checking' : event.status === 'not_sent' ? 'Request not sent' : 'Outcome needs checking';
  return <article className={`journey-card${stale ? ' journey-card--historical' : ''}`}>
    <div className="journey-card-header"><p><strong>{!stale && event.discovery ? findingLabel(event.discovery) : event.kind === 'policy_update' ? 'Policy update' : 'Work options'}</strong><span>{event.kind === 'policy_update' ? 'Express Entry' : 'C20 · Work permit'}</span></p><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{event.replay && ` · ${fictional ? 'Demo replay' : 'Requested comparison'}`}</time></div>
    {event.status !== 'completed' ? <div role="status"><h3 className="journey-state-title">{state}</h3><p>{event.status === 'not_sent' ? 'No conversation request was sent. You can try again after the connection is checked.' : event.status === 'processing' ? 'Your request is still being checked. A result will appear here once its outcome is verified.' : 'This request could not be completed reliably. It has not been retried automatically. An operator must check its recorded outcome before another request; refreshing alone does not resolve it.'}</p></div>
      : stale ? <><p className="eyebrow">Saved history</p><h3>Saved result needs checking</h3><p>{revision === null ? 'Your current profile could not be verified. This saved result is not a current assessment.' : 'Your profile, assessment date or calculator version changed. This historical item is not a current assessment.'}</p><details><summary>View the dated result</summary>{event.discovery && <Finding discovery={event.discovery} fictional={fictional} />}<Explanation event={event} /></details></>
      : <>{event.discovery && <Finding discovery={event.discovery} fictional={fictional} />}<Explanation event={event} /></>}
  </article>;
}
const answerFields:ReadonlyArray<[keyof DemoProfile,string]>=[['currentStatusValid','Current immigration status is valid'],['canadianOffer','Canadian employment offer exists'],['reciprocalProgramReported','HR reports reciprocal opportunities abroad for Canadians or permanent residents'],['employerPortalOffer','Employer Portal offer is already submitted'],['spouseAccompanying','Spouse is accompanying'],['physicallyCanada','Work was physically in Canada throughout'],['authorizedWork','Work was authorized throughout'],['paidEmployee','Paid employee throughout'],['fullTimeStudy','Any full-time study during this work'],['selfEmployed','Any self-employment during this work']];
export function DemoJourneyPanel({request,onAvailabilityChange}:{request:Request;onAvailabilityChange?:(available:boolean)=>void}) {
  const [available,setAvailable]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [snapshot,setSnapshot]=useState<DemoSnapshot|null>(null),[draft,setDraft]=useState<DemoProfile|null>(null),[pending,setPending]=useState<Proposal[]>([]),[events,setEvents]=useState<JourneyEvent[]>([]);
  const [loading,setLoading]=useState(true);
  const beginNavigation=useFlowNavigation();
  useEffect(()=>onAvailabilityChange?.(available),[available,onAvailabilityChange]);
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
  useEffect(()=>{let alive=true;void request<{available:boolean}>('/api/demo/status').then(async s=>{if(!alive)return;setAvailable(s.available);if(s.available)await refresh(true);}).catch(e=>alive&&setError(e.message)).finally(()=>alive&&setLoading(false));return()=>{alive=false;};},[request]);
  async function act(run:()=>Promise<void>,target?:string){const navigation=target?beginNavigation():null;let destination=target;setBusy(true);setError('');setNotice('');try{await run();}catch(e){setError(e instanceof Error?e.message:'This request could not be verified.');destination='journey-error';}finally{setBusy(false);navigation?.complete(destination);}}
  async function propose(event:FormEvent){event.preventDefault();if(!draft||!snapshot)return;await act(async()=>{
    const parsed=demoProfileSchema.safeParse(draft);if(!parsed.success)throw Error('Review the demonstration dates, duties and profile fields.');
    const result=await request<Proposal>('/api/demo/proposals',{baseRevision:snapshot.revision,profile:parsed.data});setPending([result]);setNotice('Review this exact fictional profile before saving it to memory.');
  },'demo-profile-review-heading');}
  async function save(proposal:Proposal, action:'confirm'|'reconcile') { await act(async()=>{
    if(action==='confirm')setPending(current=>current.map(item=>item.id===proposal.id?{...item,status:'applying'}:item));
    try {
      const result=await request<DemoSnapshot>(`/api/demo/proposals/${proposal.id}/${action}`,action==='confirm'?{confirm:true}:{});
      if(!result.verified||!result.profile)throw Error('The save could not be verified. Check its status before continuing.');
      await refresh(true);setNotice(action==='confirm'?'The fictional profile was saved and read back from memory.':'Your earlier save was verified. Nothing was sent again.');
    } catch(reason) { try { await refresh(); } catch { /* Keep the check-only state until readback succeeds. */ } throw reason; }
  },'journey-feedback'); }
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
  },'journey-title');}
  if (!available && !loading && !error) return null;
  const blocked=busy||pending.length>0||!!requestPending||events.some(e=>['processing','uncertain'].includes(e.status));
  const { current, history } = splitJourney(events);
  return <section className="demo-journey" aria-labelledby="journey-title" id="journey">
    <div className="journey-intro"><div><h2 id="journey-title" className="visually-hidden" tabIndex={-1}>Your discoveries</h2><p className="journey-profile-label"><span className="demo-tag" title="Fictional demonstration profile">Demo profile</span><span>{snapshot?.profile ? `${snapshot.profile.name}` : loading || busy ? 'Checking your demonstration profile…' : snapshot ? 'Review the fictional profile to begin' : 'Profile could not be verified'}</span></p></div><button className="text-button" aria-label="Refresh journey" disabled={busy || loading} onClick={()=>void act(()=>refresh())}>{busy || loading ? 'Checking…' : 'Refresh'}</button></div>
    {error&&<p id="journey-error" tabIndex={-1} className="notice error" role="alert">{error}</p>}{notice&&<p id="journey-feedback" tabIndex={-1} className="notice" role="status">{notice}</p>}
    {pending.map((proposal,index)=><section className="review" key={proposal.id}><h3 id={index===0?'demo-profile-review-heading':undefined} tabIndex={-1}>Confirm this fictional profile</h3><p>This saves only the designated demonstration entity in memory. It does not replace your ordinary employment record.</p>{proposal.profile&&<details open><summary>Exact values to save</summary><dl className="demo-review">{Object.entries(proposal.profile).map(([field,value])=><div key={field}><dt>{field.replace(/([A-Z])/g,' $1')}</dt><dd>{value!==null&&typeof value==='object'?<pre>{JSON.stringify(value,null,2)}</pre>:String(value??'Not recorded')}</dd></div>)}</dl></details>}<GuideSaveActions demo status={proposal.status} busy={busy} blocked={false} confirm={()=>void save(proposal,'confirm')} reconcile={()=>void save(proposal,'reconcile')} reject={()=>void act(async()=>{await request('/api/demo/proposals/'+proposal.id+'/reject',{});await refresh();setNotice('The demonstration profile change was discarded.');},'journey-feedback')} /></section>)}

    {requestPending && <p className="notice" role="status">{busy ? 'Checking the official sources and your saved profile.' : 'This request’s outcome needs checking. Refresh its status before starting another.'}</p>}
    <div className="journey-results" aria-live="polite">{current.map(event=><JourneyCard key={event.id} event={event} revision={snapshot?.verified ? snapshot.revision : null} date={date}/>)}</div>
    {!events.length && (loading ? <p role="status">Checking your saved discoveries…</p> : error ? <p className="muted">{snapshot ? 'No new discovery is available. Review the message above before trying again.' : 'Your saved journey could not be loaded. Refresh to check again.'}</p> : <div className="journey-empty"><h3>A clearer next step starts with your story.</h3><p>{snapshot?.profile ? 'Ask Maple Guide about your work options. Your discoveries will be saved here, with the evidence and actions behind them.' : 'Review the fictional profile below to begin. Saved discoveries appear after the real workflow completes.'}</p></div>)}
    {history.length>0&&<details className="journey-history"><summary>Saved journey history ({history.length})</summary><p className="hint">Earlier discoveries stay available with their original dates, sources and explanations.</p><div className="journey-results">{history.map(event=><JourneyCard key={event.id} event={event} revision={snapshot?.verified ? snapshot.revision : null} date={date}/>)}</div></details>}
    <details className="journey-tools" open={!events.length}><summary>Ask Maple Guide or review your demonstration profile</summary><div className="journey-tools-content">
    <div className="guide-prompt"><label htmlFor="guide-question">What would you like to understand?</label><textarea id="guide-question" maxLength={2000} aria-describedby="guide-question-help" value={question} onChange={e=>setQuestion(e.target.value)} disabled={blocked||!snapshot?.profile}/><button disabled={blocked||!snapshot?.profile||!question.trim()} onClick={()=>void research('discover')}>{busy?'Checking sources and memory…':'Explore work options'}</button><p className="hint" id="guide-question-help">Up to 2,000 characters. This first guide experience researches reciprocal employment. It is not a complete search of every immigration pathway.</p></div>
    {draft&&<details className="demo-profile" open={!snapshot?.profile}><summary>{snapshot?.profile?'Review or edit demonstration profile':'Review fictional demonstration profile'}</summary><p className="hint">All details below—including HR’s reported program—are invented for this demonstration. They are not evidence about a real employer.</p><form onSubmit={propose}><fieldset disabled={busy||pending.length>0}><legend className="visually-hidden">Fictional profile</legend>
      <div className="field-grid">{([['name','Demo name'],['employer','Fictional employer'],['jobTitle','Job title'],['noc','Reviewed NOC']] as const).map(([field,label])=><label key={field}>{label}<input required value={draft[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})}/></label>)}</div>
      <div className="field-grid">{([['arrivedInCanada','Arrival in Canada'],['permitExpiry','Your work permit expiry'],['spousePermitExpiry','Spouse work permit expiry'],['workStart','Consistent Canadian work began']] as const).map(([field,label])=><label key={field}>{label}<input type="date" required={field!=='spousePermitExpiry'} value={draft[field]??''} onChange={e=>setDraft({...draft,[field]:e.target.value||null})}/></label>)}</div>
      <label>Weekly hours<input type="number" min="0.01" max="168" step="any" value={draft.weeklyHours} onChange={e=>setDraft({...draft,weeklyHours:Number(e.target.value)})}/></label>
      <label>Actual fictional duties<textarea value={draft.duties} onChange={e=>setDraft({...draft,duties:e.target.value})}/></label><label className="checkbox"><input type="checkbox" checked={draft.nocReviewed} onChange={e=>setDraft({...draft,nocReviewed:e.target.checked})}/>I reviewed the fictional duties against the NOC.</label>
      <div className="field-grid">{answerFields.map(([field,label])=><label key={field}>{label}<select value={String(draft[field])} onChange={e=>setDraft({...draft,[field]:e.target.value})}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></label>)}</div>
      <label>Reciprocity documents<select value={draft.reciprocalEvidence} onChange={e=>setDraft({...draft,reciprocalEvidence:e.target.value as DemoProfile['reciprocalEvidence']})}><option value="unknown">Unknown</option><option value="not_requested">Not requested</option><option value="promised">HR has promised supporting documents</option><option value="documents_available">Documents available for review</option></select></label>
      <label>Qualifying Express Entry offer assessment<select value={draft.qualifyingExpressEntryOffer} onChange={e=>setDraft({...draft,qualifyingExpressEntryOffer:e.target.value as DemoProfile['qualifyingExpressEntryOffer']})}><option value="not_reviewed">Not reviewed</option><option value="none_reviewed">This fictional scenario has no qualifying Express Entry offer</option><option value="reviewed_offer">Qualifying offer reviewed in the CRS evidence section</option></select></label>
      <CrsEvidenceEditor value={draft.crsEvidence} asOf={date} spouseAccompanying={draft.spouseAccompanying} onChange={crsEvidence=>{const next={...draft};if(crsEvidence)next.crsEvidence=crsEvidence;else delete next.crsEvidence;setDraft(next);}}/><button type="submit">Review demo profile</button></fieldset></form></details>}
    </div></details>
    <details className="demo-replay"><summary>Demo controls: official policy replay</summary><p>Process the real October 16 Express Entry announcement against the same saved profile. On October 25, the November 3 change is future policy. This records a component comparison, or a complete fictional points estimate only when every CRS factor has been reviewed.</p><button className="secondary" disabled={blocked||!snapshot?.profile} onClick={()=>void research('policy-replay')}>Process official Express Entry update</button></details>
  </section>;
}

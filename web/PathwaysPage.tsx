import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import type {JourneyEvent} from '../shared/demo.js';
import {businessDate} from '../shared/business-date.js';
import {watchAssessmentRefresh} from './assessment-refresh.js';
import {JourneyCard} from './DemoJourneyPanel.js';
import {AssessmentConclusion} from './AssessmentPanel.js';
import {findingReason} from './journey-presentation.js';
import {openWorkspaceSection} from './DashboardOverview.js';
import {openPathways} from './pathways-navigation.js';
import {loadPathways,latestPathwayEvent,pathwayEventState,type PathwaysReadback} from './pathways-readback.js';
import './PathwaysPage.css';

type Props={request:<T>(path:string)=>Promise<T>;employmentRevision:number|null;blocked:boolean;refreshKey:number;selected:string};
export function PathwaysPage({request,employmentRevision,blocked,refreshKey,selected}:Props) {
 const [readback,setReadback]=useState<PathwaysReadback|null>(null),[loading,setLoading]=useState(true);
 const [date,setDate]=useState(()=>businessDate(new Date()));const generation=useRef(0),resolvedKey=useRef<string|null>(null);
 const loadKey=JSON.stringify([employmentRevision,refreshKey]);
 const refresh=useCallback(async()=>{const attempt=++generation.current;setReadback(null);setLoading(true);setDate(businessDate(new Date()));if(blocked){setLoading(false);return;}try{const next=await loadPathways(request,employmentRevision);if(attempt===generation.current)setReadback(next);}catch{if(attempt===generation.current)setReadback(null);}finally{if(attempt===generation.current){resolvedKey.current=loadKey;setLoading(false);}}},[request,employmentRevision,blocked,loadKey]);
 useEffect(()=>{void refresh();const stop=watchAssessmentRefresh(()=>{void refresh();},window,document);return()=>{stop();generation.current++;};},[refresh]);
 return <PathwaysContent readback={readback} loading={loading||resolvedKey.current!==loadKey} blocked={blocked} employmentRevision={employmentRevision} date={date} selected={selected} refresh={()=>void refresh()}/>;
}
function WorkspaceLink({href,children}:{href:string;children:ReactNode}) { return <a href={href} onClick={event=>{event.preventDefault();openWorkspaceSection(href);}}>{children}</a>; }
function UpdateLink({event,children}:{event:JourneyEvent;children:ReactNode}) { return <a className="pathways-action" href={'#pathways/update/'+encodeURIComponent(event.id)} onClick={click=>{click.preventDefault();openPathways(event.id);}}>{children}<span aria-hidden="true"> →</span></a>; }
const stateCopy={checking:['Still checking','The request is processing. Review its status before starting another.'],uncertain:['Outcome needs checking','The result has not been verified. Check the original request without resending it.'],failed:['Check did not complete','Open the saved update to review the source or request status.'],unavailable:['Result unavailable','No complete finding is available for this saved request.'],stale:['Needs review','Your information or the assessment date changed. Review this saved check before relying on it.']} as const;
function FindingSummary({event,readback,date}:{event:JourneyEvent;readback:PathwaysReadback;date:string}) {
 const state=pathwayEventState(event,readback.revision,date),d=event.discovery;
 if(state!=='current'||!d){const copy=stateCopy[state==='current'?'unavailable':state];return <><span className="pathways-status">{copy[0]}</span><p>{copy[1]}</p><UpdateLink event={event}>Review saved update</UpdateLink></>;}
 const c20=d.kind==='c20';const score=d.crs?.status==='complete'?d.crs:null;
 const qualification=d.outstanding[0]?.startsWith('The overall maximum under the announced allocation remains unresolved')?'Policy cap unresolved; this estimate is below the disputed limit.':d.outstanding[0];
 const employerQualification=d.outstanding[0]?.startsWith('Obtain the employer')?'Employer exchange evidence still needs review.':d.outstanding[0];
 return <>
  <span className="pathways-status">{c20?(d.status==='potential_pathway'?'Potential option':d.status==='not_supported'?'Not supported by these facts':'More information needed'):score?(score.projected?'Projected impact':'Calculated impact'):'More information needed'}</span>
  {score&&<div className="pathways-score" aria-label={`${score.projected?'Projected ':''}CRS change ${score.delta}, from ${score.before} to ${score.after}`}><strong>{score.delta>0?'+':''}{score.delta}<small>CRS points</small></strong><div><span>Previous <b>{score.before}</b></span><span aria-hidden="true">→</span><span>{score.projected?'Projected':'New'} <b>{score.after}</b></span></div></div>}
  <p>{findingReason(d)}</p>
  {score&&<p className="pathways-qualification">{score.projected?'Projected · effective ':'Effective '}<time dateTime={score.effectiveFrom}>{score.effectiveFrom}</time> · Points assessment; eligibility is not established.</p>}
  {score&&qualification&&<p className="pathways-qualification">{qualification}</p>}
  {c20&&<p className="pathways-qualification">Eligibility is not established.{employerQualification&&<> {employerQualification}</>}</p>}
  {!c20&&!score&&d.outstanding[0]&&<p className="pathways-qualification">{d.outstanding[0]}</p>}
  {c20&&d.nextSteps[0]&&<div className="pathways-next"><strong>Next step</strong><p>{d.nextSteps[0]}</p></div>}
  <UpdateLink event={event}>{score?'Review score breakdown':'Review evidence and next steps'}</UpdateLink>
 </>;
}
export function PathwaysContent({readback,loading,blocked,employmentRevision,date,selected,refresh}:{readback:PathwaysReadback|null;loading:boolean;blocked:boolean;employmentRevision:number|null;date:string;selected:string;refresh:()=>void}) {
 const event=selected?readback?.events.find(item=>item.id===selected):null;
 const c20=readback&&latestPathwayEvent(readback.events,'discovery'),impact=readback&&latestPathwayEvent(readback.events,'policy_update');
 // Only the existing CEC check has an established PR classification. Other
 // registered programs retain their own labels without guessing their category.
 const requirementsTitle=readback?.policies.some(policy=>policy.id!=='cec-canadian-work-experience')?'Program requirements':'Permanent residence';
 return <section className="pathways-page" aria-labelledby="pathways-title">
  <a className="profile-back" href={selected?'#pathways':'#overview'} onClick={click=>{click.preventDefault();selected?openPathways():openWorkspaceSection('#overview');}}>← {selected?'Back to pathways':'Back to overview'}</a>
  <header className="pathways-heading"><div><p className="profile-eyebrow">Your Maple workspace</p><h1 id="pathways-title" tabIndex={-1}>{selected?'Your saved update':'Your pathways'}</h1><p>{selected?'The evidence, conditions and next step behind this check.':'Options to investigate. Changes that matter to your plans.'}</p></div><button type="button" className="secondary" disabled={loading||blocked} onClick={refresh}>{loading?'Checking…':'Refresh saved checks'}</button></header>
  {readback?.fictional&&<p className="pathways-context">Demo scenario · Illustrative inputs, separate from your personal profile.</p>}
  {blocked?<p className="notice" role="status">Your information is being checked. Results will stay on hold until the update is resolved. <WorkspaceLink href="#native-memory-heading">Review update status</WorkspaceLink></p>:loading?<p className="pathways-loading" role="status">Loading your saved options and updates.</p>:!readback?<p role="alert">Saved checks are unavailable. Refresh to try reading them again.</p>:<>
   {readback.guideError&&<p className="notice error" role="alert">{readback.guideError} Refresh to check the connection.</p>}
   {selected?(event?<JourneyCard event={event} revision={readback.revision} date={date} fictional={readback.fictional}/>:!readback.guideError&&<p>This saved update is unavailable. Return to pathways to see the current list.</p>):<>
    <section className="pathways-section" aria-labelledby="work-pathways-heading"><div className="pathways-section-label"><p>Continue working</p><h2 id="work-pathways-heading">Work permits</h2></div><div className="pathways-section-body"><h3>Reciprocal employment <span>C20</span></h3>{c20?<FindingSummary event={c20} readback={readback} date={date}/>:<><span className="pathways-status">{readback.guideError?'Unavailable':'Not assessed yet'}</span><p>{readback.guideError?'A current check could not be read.':'Maple can investigate employer-backed reciprocal employment using your reviewed information.'}</p><WorkspaceLink href={readback.needsReview?'#profile':'#journey'}>{readback.needsReview?'Review your profile':'Explore work options with Maple'}</WorkspaceLink></>}</div></section>
    <section className="pathways-section" aria-labelledby="policy-impact-heading"><div className="pathways-section-label"><p>What changed</p><h2 id="policy-impact-heading">Policy impact</h2></div><div className="pathways-section-body pathways-impact"><h3>Express Entry score</h3>{impact?<FindingSummary event={impact} readback={readback} date={date}/>:<><span className="pathways-status">{readback.guideError?'Unavailable':'No saved comparison'}</span><p>A reviewed policy comparison shows how a change affects your points. It is separate from choosing a pathway.</p><WorkspaceLink href="#journey">Review your Guide</WorkspaceLink></>}</div></section>
    <section className="pathways-section" aria-labelledby="pr-pathways-heading"><div className="pathways-section-label"><p>Plan ahead</p><h2 id="pr-pathways-heading">{requirementsTitle}</h2></div><div className="pathways-section-body">{readback.checksError?<p role="alert">{readback.checksError}</p>:!readback.policies.length?<><h3>No reviewed route check available yet</h3><p>Your Express Entry score does not establish eligibility for a permanent-residence program. Available requirement checks will appear here when activated.</p></>:<><p className="pathways-qualification">These cover specific requirements, not full program eligibility.</p>{readback.policies.map(policy=>{const assessment=readback.assessments.find(item=>item.policy.id===policy.id&&item.policy.digest===policy.digest);return <article className="pathways-requirement" key={policy.digest}><p className="pathways-program">{policy.program}</p><h3>{policy.title}</h3>{assessment?<AssessmentConclusion assessment={assessment} revision={employmentRevision}/>:<p>Not checked against your saved facts yet.</p>}<a href={policy.sourceUrl} target="_blank" rel="noreferrer">Official requirements ↗</a></article>;})}</>}<WorkspaceLink href="#assessment-heading">Review requirement checks</WorkspaceLink></div></section>
    <section className="pathways-section pathways-updates" aria-labelledby="pathways-updates-heading"><div className="pathways-section-label"><p>Your workspace</p><h2 id="pathways-updates-heading">Saved updates</h2></div><div className="pathways-section-body">{readback.guideError?<p>Updates are unavailable until the connection is checked.</p>:!readback.events.length?<p>No saved updates yet. Completed checks will remain available here.</p>:<ul>{readback.events.map(item=><li key={item.id}><div><strong>{item.kind==='discovery'?'Work-permit check':'Policy comparison'}</strong><span>{item.createdAt.slice(0,10)} · {item.status==='completed'?(pathwayEventState(item,readback.revision,date)==='current'?'Saved result':'Needs review'):item.status==='processing'?'Still checking':item.status==='uncertain'?'Outcome unverified':'Check did not complete'}</span></div><UpdateLink event={item}>Review</UpdateLink></li>)}</ul>}</div></section>
   </>}
  </>}
 </section>;
}

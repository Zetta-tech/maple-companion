import type { ReactNode } from 'react';
import type { Employment } from '../shared/employment.js';
import type { LanguageEvidence } from '../shared/crs.js';
import type { PersonalGuideSnapshot } from '../shared/personal-guide.js';
import { openProfile, type ProfileSection } from './profile-navigation.js';
import './ProfilePage.css';

export type ProfileGuideReadback = { snapshot: PersonalGuideSnapshot | null; loading: boolean; error: string; dirty: boolean };
const sectionNames: Record<ProfileSection, string> = { overview: 'Your profile', employment: 'Employment', education: 'Education', languages: 'Language tests', status: 'Personal details', assessment: 'Assessment evidence' };
const educationNames: Record<string, string> = { less_secondary:'Less than secondary', secondary:'Secondary diploma', one_year:'One-year credential', two_year:'Two-year credential', bachelors:'Bachelor or three-year credential', two_or_more:'Two or more credentials', masters_professional:'Master or eligible professional degree', doctoral:'Doctorate', unknown:'Not recorded' };
export function profileDate(date: string | null | undefined): string {
  if (!date) return 'Not recorded';
  return new Intl.DateTimeFormat('en-CA', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' }).format(new Date(date + 'T00:00:00Z'));
}
function SummarySection({ title, section, children, action = 'Edit' }: { title:string; section:ProfileSection; children:ReactNode; action?:string }) {
  return <section className="profile-summary-section"><div className="profile-section-heading"><h2>{title}</h2><a href={'#profile/' + section} onClick={event => { event.preventDefault(); openProfile(section); }} aria-label={`${action} ${title.toLowerCase()}`}>{action}<span aria-hidden="true"> ↗</span></a></div>{children}</section>;
}
export function LanguageSummary({ evidence, label }: { evidence:LanguageEvidence; label:string }) {
  if (evidence.status !== 'tested') return <p className="profile-empty">{label}: {evidence.status === 'not_taken' ? 'No test recorded' : 'Not recorded'}</p>;
  return <div className="profile-history-entry"><div className="profile-entry-heading"><h3>{evidence.test ?? `${label} test`}</h3><span>{profileDate(evidence.date)}</span></div>
    <dl className="profile-language-scores">{(['listening','reading','writing','speaking'] as const).map(ability => <div key={ability}><dt>{ability[0]!.toUpperCase() + ability.slice(1)}</dt><dd>{evidence[ability] === null ? <span className="profile-unknown">Not recorded</span> : <>{evidence[ability]} <small>{label === 'French' ? 'NCLC' : 'CLB'}</small></>}</dd></div>)}</dl>
    {evidence.benchmarkConversionReviewed !== 'yes' && <p className="profile-note">Benchmarks need review before they can support a score.</p>}
  </div>;
}
export function ProfilePage({ section, employment, available, loading, guide, dirty }: { section:ProfileSection; employment:Employment|null; available:boolean; loading:boolean; guide:ProfileGuideReadback; dirty:boolean }) {
  const intake = guide.snapshot?.intake;
  const history = intake?.history;
  const evidence = intake?.crsEvidence;
  const unavailable = !guide.loading && (!guide.snapshot || !!guide.error);
  return <section id="profile" className="profile-page" aria-labelledby="profile-page-title">
    <a className="profile-back" href={section === 'overview' ? '#overview' : '#profile'} onClick={section === 'overview' ? undefined : event => { event.preventDefault(); openProfile(); }}>← {section === 'overview' ? 'Back to overview' : 'Back to your profile'}</a>
    <header className="profile-page-heading"><div><p className="profile-eyebrow">Your information</p><h1 id="profile-page-title" tabIndex={-1}>{sectionNames[section]}</h1><p>{section === 'overview' ? 'Your work, education and language records, together.' : 'Edit your details, then review the exact change before confirming.'}</p></div>{dirty && <span className="profile-draft-status" role="status">Unsaved changes</span>}</header>
    {dirty && <p className="profile-note">Your draft stays while you move around this workspace. Review and confirm to save it.</p>}
    {section === 'overview' && <div className="profile-summary-list">
      <SummarySection title="Employment" section="employment">
        {loading ? <p role="status">Loading your employment.</p> : !available ? <p>Saved employment could not be checked. Reconnect before editing.</p> : employment ? <><div className="profile-entry-heading"><h3>{employment.title}</h3><span>{employment.employer}</span></div><dl className="profile-facts"><div><dt>Work period</dt><dd>{profileDate(employment.startDate)} – {employment.currentJob ? 'Present' : profileDate(employment.endDate)}</dd></div><div><dt>Work country</dt><dd>{employment.countryCode}</dd></div>{employment.hoursPerWeek !== null && <div><dt>Schedule</dt><dd>{employment.hoursPerWeek} hours / week</dd></div>}</dl></> : <p className="profile-empty">Add your employment to get started.</p>}
        <p className="profile-note">One employment record is supported today. Multiple jobs and complex work periods need separate review.</p>
      </SummarySection>
      {guide.loading ? <p role="status" className="profile-readback-status">Loading your education and language records.</p> : unavailable ? <section className="profile-readback-status"><h2>Your Guide records are unavailable</h2><p>They could not be verified. Open personal details to check the connection before editing.</p><a href="#profile/status" onClick={event => { event.preventDefault(); openProfile('status'); }}>Check profile status</a></section> : <>
        {guide.snapshot?.reviewRequired && <p className="profile-readback-status" role="status">These are your saved details. Assessment inputs need review against your current employment.</p>}
        <SummarySection title="Education" section="education">
          {history?.education.length ? history.education.map(record => <div className="profile-history-entry" key={record.id}><div className="profile-entry-heading"><h3>{record.program}</h3><span>{record.institution}</span></div>{record.credential && <p>{record.credential}</p>}{(record.startDate || record.endDate) && <p className="profile-note">{profileDate(record.startDate)} – {profileDate(record.endDate)}</p>}{record.notes && <p className="profile-note">{record.notes}</p>}</div>) : <p className="profile-empty">No education history added yet.</p>}
          {evidence?.education.level && evidence.education.level !== 'unknown' && <p className="profile-note">Current assessment category: {educationNames[evidence.education.level]}. {evidence.education.qualificationReviewed !== 'yes' && 'Equivalency needs review.'}</p>}
        </SummarySection>
        <SummarySection title="Language tests" section="languages">
          {history?.languageTests.length ? history.languageTests.map(test => <div key={test.id}><LanguageSummary evidence={test} label={test.language === 'english' ? 'English' : 'French'} />{test.notes && <p className="profile-note">{test.notes}</p>}</div>) : evidence ? <><p className="profile-note">Current assessment evidence</p><LanguageSummary evidence={evidence.english} label="English" /><LanguageSummary evidence={evidence.french} label="French" /></> : <p className="profile-empty">No test results recorded. You can leave scores unknown until you have the report.</p>}
        </SummarySection>
        <SummarySection title="Personal details" section="status"><dl className="profile-facts"><div><dt>Name</dt><dd>{intake?.name ?? 'Not recorded'}</dd></div><div><dt>Arrival in Canada</dt><dd>{profileDate(intake?.arrivedInCanada)}</dd></div><div><dt>Permit expiry</dt><dd>{profileDate(intake?.permitExpiry)}</dd></div></dl></SummarySection>
        <SummarySection title="Assessment evidence" section="assessment" action="Review"><p className="profile-empty">Review the education equivalency, current language evidence, work conditions and other factors used in your score.</p><p className="profile-note">History entries alone do not establish eligibility or add points.</p></SummarySection>
      </>}
    </div>}
  </section>;
}

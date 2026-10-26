import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyPersonalIntake, type PersonalProfile } from '../shared/personal-guide.js';
import { emptyCrsEvidence, fictionalCrsEvidence } from '../shared/crs.js';
import { demoSeed } from '../shared/demo.js';
import { projectExpressEntry } from '../server/discovery.js';
import { fixtureSources } from './support/demo-fixture.js';
import { CrsEvidenceEditor } from '../web/CrsEvidenceEditor.js';
import { JourneyCard } from '../web/DemoJourneyPanel.js';
import { GuideReviewNotice, normalizePersonalIntakeEndDate, PersonalInputReview } from '../web/PersonalGuidePanel.js';
import { GuideSaveActions } from '../web/GuideSaveActions.js';
import { GuideEmploymentSetup } from '../web/GuideEmploymentSetup.js';
import { guidePendingAfterFailure, nativePendingAfterFailure, readResponse, RequestError } from '../web/request.js';

describe('personal Guide frontend boundaries', () => {
  it('routes missing employment to setup and unresolved employment to review, without offering research', () => {
    const firstUse = renderToStaticMarkup(<GuideEmploymentSetup />);
    expect(firstUse).toContain('href="#employment-employer"');
    expect(firstUse).toContain('aria-controls="employment-editor"');
    expect(firstUse).toContain('employer, job title, start date and work country');
    expect(firstUse).not.toContain('<textarea');
    const pending = renderToStaticMarkup(<GuideEmploymentSetup pending />);
    expect(pending).toContain('href="#changes-heading"');
    expect(pending).not.toContain('Add employment details');
    expect(pending).not.toContain('href="#employment-employer"');
  });
  it('offers a named recovery action linked to the existing editor, unavailable until inputs are ready', () => {
    const ready = renderToStaticMarkup(<GuideReviewNotice disabled={false} onReview={() => {}} />);
    expect(ready).toContain('>Review Guide details</button>');
    expect(ready).toContain('type="button"');
    expect(ready).toContain('aria-controls="personal-guide-tools personal-guide-editor"');
    expect(ready).not.toContain('disabled');
    expect(renderToStaticMarkup(<GuideReviewNotice disabled onReview={() => {}} />)).toContain('disabled');
  });
  it.each([
    ['2026-09-01', '2026-10-01'],
    [null, '2026-10-01'],
    ['2026-10-01', null],
  ])('normalizes restored CRS end date %s to confirmed employment %s without replacing other evidence', (savedEnd, confirmedEnd) => {
    const intake = { ...emptyPersonalIntake, name: 'Reviewed name', crsEvidence: { ...fictionalCrsEvidence('2026-10-25'), canadianWorkEnd: savedEnd, completeEvidenceReviewed: 'yes' as const } };
    const original = structuredClone(intake);
    // The employment effect has already run with no draft when the saved intake arrives.
    expect(normalizePersonalIntakeEndDate(null, confirmedEnd)).toBeNull();
    const restored = normalizePersonalIntakeEndDate(intake, confirmedEnd)!;
    expect(restored).toEqual({ ...intake, crsEvidence: { ...intake.crsEvidence, canadianWorkEnd: confirmedEnd, completeEvidenceReviewed: 'unknown' } });
    expect(intake).toEqual(original);
    expect(restored.crsEvidence!.education).toBe(intake.crsEvidence.education);
    expect(restored.crsEvidence!.english).toBe(intake.crsEvidence.english);
    expect(normalizePersonalIntakeEndDate(restored, confirmedEnd)).toBe(restored);
  });
  it('normalizes subsequent employment changes while preserving unsaved intake edits', () => {
    const draft = { ...emptyPersonalIntake, name: 'Unsaved name', canadianOffer: 'yes' as const, crsEvidence: { ...emptyCrsEvidence('2026-10-25'), completeEvidenceReviewed: 'yes' as const } };
    const ended = normalizePersonalIntakeEndDate(draft, '2026-10-01')!;
    expect(ended.name).toBe('Unsaved name'); expect(ended.canadianOffer).toBe('yes');
    expect(ended.crsEvidence!.canadianWorkEnd).toBe('2026-10-01');
    expect(ended.crsEvidence!.completeEvidenceReviewed).toBe('unknown');
    expect(normalizePersonalIntakeEndDate(ended, null)!.crsEvidence!.canadianWorkEnd).toBeNull();
  });
  it('preserves reviewed evidence when the canonical date matches, and never invents missing employment or CRS evidence', () => {
    const intake = { ...emptyPersonalIntake, crsEvidence: { ...emptyCrsEvidence('2026-10-25', '2026-10-01'), completeEvidenceReviewed: 'yes' as const } };
    expect(normalizePersonalIntakeEndDate(intake, '2026-10-01')).toBe(intake);
    expect(normalizePersonalIntakeEndDate(intake, undefined)).toBe(intake);
    expect(normalizePersonalIntakeEndDate(emptyPersonalIntake, '2026-10-01')).toBe(emptyPersonalIntake);
  });
  it('offers readback, never confirmation or discard, while a save is unresolved', () => {
    const actions = { confirm() {}, reconcile() {}, reject() {} };
    for (const status of ['applying', 'uncertain']) {
      const html = renderToStaticMarkup(<GuideSaveActions status={status} busy={false} blocked {...actions} />);
      expect(html).toContain('Check save status');
      expect(html).not.toContain('Confirm and save');
      expect(html).not.toContain('Discard');
      expect(html).not.toContain('disabled');
    }
    const pending = renderToStaticMarkup(<GuideSaveActions status="pending" busy={false} blocked={false} {...actions} />);
    expect(pending).toContain('Confirm and save Guide details');
    expect(pending).not.toContain('Check save status');
    expect(renderToStaticMarkup(<GuideSaveActions status="pending" busy={false} blocked {...actions} />)).toContain('disabled');
  });
  it('only releases a Guide request on its own explicit pre-dispatch receipt', async () => {
    for (const status of [400, 413, 429, 503]) {
      for (const receipt of [undefined, 'not_started']) {
        let error: unknown;
        try { await readResponse(new Response(JSON.stringify({ error: { code: 'OFFICIAL_SOURCE_UNAVAILABLE', message: 'Could not check', guideRequestState: receipt } }), { status })); } catch (reason) { error = reason; }
        expect(guidePendingAfterFailure('request-id', error)).toBe(receipt ? null : 'request-id');
        expect(nativePendingAfterFailure('native-id', error)).toBe('native-id');
      }
    }
    expect(guidePendingAfterFailure('request-id', new RequestError('Not sent', 'X', 'not_started'))).toBe('request-id');
  });
  it('offers unknown personal evidence without any fictional defaults or editable canonical end date', () => {
    const unopened = renderToStaticMarkup(<CrsEvidenceEditor value={undefined} asOf="2026-10-25" spouseAccompanying="unknown" fictional={false} onChange={() => {}} />);
    expect(unopened).toContain('Starts with unknown answers');
    expect(unopened).not.toContain('invented example');
    const evidence = emptyCrsEvidence('2026-10-25', '2026-10-01');
    const opened = renderToStaticMarkup(<CrsEvidenceEditor value={evidence} asOf="2026-10-25" spouseAccompanying="unknown" fictional={false} employmentEndDate="2026-10-01" onChange={() => {}} />);
    expect(opened).not.toContain('1995-04-15');
    expect(opened).toContain('disabled="" value="2026-10-01"');
    expect(opened).not.toContain('fictional CRS factor');
  });
  it('shows the exact assembled personal inputs without making receipt hashes the headline', () => {
    const profile: PersonalProfile = { ...emptyPersonalIntake, inputPurpose: 'reviewed-assessment-inputs', employmentBasis: { revision: 7, receiptDigest: 'b'.repeat(64) }, employer: 'Example employer', jobTitle: 'Analyst', workStart: '2024-01-15', weeklyHours: null, noc: null, duties: '', nocReviewed: false, physicallyCanada: 'unknown', authorizedWork: 'unknown', paidEmployee: 'unknown', fullTimeStudy: 'unknown', selfEmployed: 'unknown', intervalComplete: false };
    const html = renderToStaticMarkup(<PersonalInputReview profile={profile} />);
    expect(html).toContain('Example employer'); expect(html).toContain('Unknown');
    expect(html).toContain('Saved employment reference'); expect(html).toContain('b'.repeat(64));
    expect(html).not.toContain('Avery'); expect(html).not.toContain('fictional');
    const withHistory = renderToStaticMarkup(<PersonalInputReview profile={{...profile,history:{version:1,education:[{id:'428b59b8-4a16-4fc4-a415-c0f1be80da39',institution:'Example college',program:'Engineering',credential:'',startDate:null,endDate:null,notes:'Credential category not reviewed.'}],languageTests:[]}}}/>);
    expect(withHistory).toContain('Education history');expect(withHistory).toContain('Example college');expect(withHistory).toContain('Credential category not reviewed.');expect(withHistory).toContain('No test records will be kept.');
    expect(withHistory).not.toContain('428b59b8-4a16-4fc4-a415-c0f1be80da39');expect(withHistory).not.toContain('Review history');
  });
  it('keeps personal totals distinct from demonstration wording and withholds stale personal results', async () => {
    const evidence = fictionalCrsEvidence('2026-10-25'); evidence.completeEvidenceReviewed = 'yes';
    const discovery = projectExpressEntry({ ...demoSeed, crsEvidence: evidence }, '2026-10-25', 2, (await fixtureSources.retrieve('express_entry_full')).evidence);
    const event = { id: 'example', kind: 'policy_update' as const, createdAt: '2026-10-25T08:00:00Z', status: 'completed' as const, profileRevision: 2, discovery };
    const html = renderToStaticMarkup(<JourneyCard event={event} revision={2} date="2026-10-25" fictional={false} />);
    expect(html.slice(0, html.indexOf('<details>'))).toContain('Points estimate');
    expect(html.slice(0, html.indexOf('<details>'))).not.toContain('Demo estimate');
    expect(renderToStaticMarkup(<JourneyCard event={event} revision={null} date="2026-10-25" fictional={false} />)).toContain('not a current assessment');
  });
});

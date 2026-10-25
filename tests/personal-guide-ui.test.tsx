import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyPersonalIntake, type PersonalProfile } from '../shared/personal-guide.js';
import { emptyCrsEvidence, fictionalCrsEvidence } from '../shared/crs.js';
import { demoSeed } from '../shared/demo.js';
import { projectExpressEntry } from '../server/discovery.js';
import { fixtureSources } from './support/demo-fixture.js';
import { CrsEvidenceEditor } from '../web/CrsEvidenceEditor.js';
import { JourneyCard } from '../web/DemoJourneyPanel.js';
import { PersonalInputReview } from '../web/PersonalGuidePanel.js';
import { GuideSaveActions } from '../web/GuideSaveActions.js';
import { guidePendingAfterFailure, nativePendingAfterFailure, readResponse, RequestError } from '../web/request.js';

describe('personal Guide frontend boundaries', () => {
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

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardOverview } from '../web/DashboardOverview.js';
import type { Employment } from '../shared/employment.js';

const employment: Employment = { employer: 'Fictional employer', title: 'Analyst', duties: '', startDate: '2025-01-01', currentJob: true, endDate: null, hoursPerWeek: null, countryCode: 'CA', paid: 'unknown', authorizedToWork: 'unknown', nocCode: null, nocReviewed: false };
const ready = { employment, available: true, loading: false, held: false, pending: 0, discoveries: true, guideState: 'saved' as const };
describe('dashboard next steps preserve review and uncertainty boundaries', () => {
  it('does not show a stale employment summary when readback is unavailable', () => {
    const html = renderToStaticMarkup(<DashboardOverview {...ready} available={false} />);
    expect(html).toContain('Reconnect to your saved information');
    expect(html).not.toContain('Fictional employer');
    expect(html).not.toContain('Your discoveries are ready');
  });
  it('prioritizes an unresolved employment change over new exploration', () => {
    const html = renderToStaticMarkup(<DashboardOverview {...ready} pending={1} />);
    expect(html).toContain('Finish reviewing your change');
    expect(html).toContain('href="#changes-heading"');
    expect(html).not.toContain('Your discoveries are ready');
  });
  it.each([
    ['pending', 'Check your earlier request'],
    ['review', 'Bring your Guide up to date'],
    ['unavailable', 'Your discoveries could not be verified'],
    ['empty', 'Start with a question'],
  ] as const)('keeps the %s Guide state distinct', (guideState, copy) => {
    const html = renderToStaticMarkup(<DashboardOverview {...ready} guideState={guideState} />);
    expect(html).toContain(copy);
    expect(html).not.toContain('Your discoveries are ready');
  });
  it('leaves unknown work hours unknown and claims no eligibility', () => {
    const html = renderToStaticMarkup(<DashboardOverview {...ready} />);
    expect(html).toContain('<dd>Unknown</dd>');
    expect(html).not.toContain('40 hours');
    expect(html).not.toContain('eligible');
  });
  it('offers an available requirement-check route when Guide is disabled', () => {
    const html = renderToStaticMarkup(<DashboardOverview {...ready} discoveries={false} guideState="unavailable" />);
    expect(html).toContain('href="#assessment-heading"');
    expect(html).not.toContain('href="#journey"');
  });
});

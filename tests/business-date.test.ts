import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { businessDate, nextBusinessDay } from '../shared/business-date.js';
import type { AssessmentView } from '../shared/assessment.js';
import { AssessmentConclusion } from '../web/AssessmentPanel.js';
import { watchAssessmentRefresh } from '../web/assessment-refresh.js';

afterEach(() => { vi.useRealTimers(); });

describe('Toronto calendar boundaries', () => {
  it.each([
    ['2026-10-25T01:00:00.000Z', '2026-10-24', '2026-10-25T04:00:00.000Z'],
    ['2026-10-25T03:59:59.999Z', '2026-10-24', '2026-10-25T04:00:00.000Z'],
    ['2026-10-25T04:00:00.000Z', '2026-10-25', '2026-10-26T04:00:00.000Z'],
    ['2026-03-08T05:00:00.000Z', '2026-03-08', '2026-03-09T04:00:00.000Z'],
    ['2026-11-01T04:00:00.000Z', '2026-11-01', '2026-11-02T05:00:00.000Z'],
    ['2028-02-29T05:00:00.000Z', '2028-02-29', '2028-03-01T05:00:00.000Z'],
    ['2026-01-01T01:00:00.000Z', '2025-12-31', '2026-01-01T05:00:00.000Z'],
  ])('uses the calendar date and deadline for %s', (instant, date, deadline) => {
    expect(businessDate(new Date(instant))).toBe(date);
    expect(nextBusinessDay(new Date(instant)).toISOString()).toBe(deadline);
  });
});

describe('assessment display expiry and resume', () => {
  const result: AssessmentView = {
    id: 'test-assessment', profileRevision: 1, assessmentDate: '2026-10-24', createdAt: '2026-10-24T14:00:00.000Z',
    policy: { id: 'test-policy', version: 'v1', program: 'Synthetic test', title: 'Synthetic rule', digest: 'a'.repeat(64),
      sourceUrl: 'https://www.canada.ca/synthetic-test', sourceBodySha256: 'b'.repeat(64), effectiveFrom: '2026-01-01', effectiveTo: null },
    results: [{ criterionId: 'test', title: 'Synthetic qualifying criterion', status: 'met' }], freshness: 'current',
  };

  it('hides an expired server-current result before a fresh response arrives', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T03:59:59.999Z'));
    const render = () => renderToStaticMarkup(createElement(AssessmentConclusion, { assessment: result, revision: 1 }));
    expect(render()).toContain('<strong>Met</strong>');
    vi.advanceTimersByTime(1);
    expect(render()).not.toContain('Synthetic qualifying criterion');
    expect(render()).toContain('Run a new check');
  });

  it('refreshes at Toronto midnight and on visibility, focus and page restore, then cleans up', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T03:59:59.000Z'));
    const page = new EventTarget();
    const visibility = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    const refresh = vi.fn();
    const stop = watchAssessmentRefresh(refresh, page, visibility);
    vi.advanceTimersByTime(999);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    visibility.visibilityState = 'hidden';
    visibility.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(1);
    // A suspended tab can resume after its timers were throttled or the clock changed.
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'));
    visibility.visibilityState = 'visible';
    visibility.dispatchEvent(new Event('visibilitychange'));
    page.dispatchEvent(new Event('focus'));
    page.dispatchEvent(new Event('pageshow'));
    expect(refresh).toHaveBeenCalledTimes(4);
    stop();
    page.dispatchEvent(new Event('focus'));
    visibility.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(48 * 60 * 60 * 1000);
    expect(refresh).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(0);
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NativeAssessmentGate, sendWithAssessmentHold } from '../web/native-assessment-gate.js';
import { RequestError } from '../web/request.js';
import { AssessmentConclusion } from '../web/AssessmentPanel.js';
import type { NativeMessageResult } from '../shared/native-chat.js';
import type { AssessmentView } from '../shared/assessment.js';

const receipt: NativeMessageResult = { requestId: 'test', createdAt: '2026-10-25T12:00:00Z', status: 'verified', message: '', warnings: [] };
describe('native update assessment display gate', () => {
  it('withholds before a delayed POST dispatch and cannot clear on a pre-claim empty refresh', async () => {
    const report = vi.fn(), gate = new NativeAssessmentGate(report);
    let resolve!: (value: NativeMessageResult) => void;
    const pending = new Promise<NativeMessageResult>(done => { resolve = done; });
    const sending = sendWithAssessmentHold(gate, 'test', () => { expect(report).toHaveBeenLastCalledWith(true); return pending; });
    gate.refresh([]);
    expect(report).toHaveBeenLastCalledWith(true);
    resolve(receipt); await sending;
    expect(report).toHaveBeenLastCalledWith(false);
  });
  it.each(['processing', 'uncertain'] as const)('status refresh finding %s withholds conclusions', status => {
    const report = vi.fn(), gate = new NativeAssessmentGate(report);
    gate.refresh([{ ...receipt, status }]);
    expect(report).toHaveBeenLastCalledWith(true);
  });
  it('releases only a definitive pre-send rejection, preserving other unresolved history', async () => {
    const report = vi.fn(), gate = new NativeAssessmentGate(report);
    const error = new RequestError('Not sent', 'RATE_LIMITED', 'not_started');
    await expect(sendWithAssessmentHold(gate, 'test', async () => { throw error; })).rejects.toBe(error);
    expect(report).toHaveBeenLastCalledWith(false);
    gate.refresh([{ ...receipt, requestId: 'older', status: 'uncertain' }]);
    gate.begin('test'); gate.fail('test', error);
    expect(report).toHaveBeenLastCalledWith(true);
  });
  it('retains a transport-unknown hold across refresh without a matching receipt', async () => {
    const report = vi.fn(), gate = new NativeAssessmentGate(report);
    await expect(sendWithAssessmentHold(gate, 'test', async () => { throw new TypeError('lost response'); })).rejects.toThrow();
    gate.refresh([]); expect(report).toHaveBeenLastCalledWith(true);
    gate.refresh([{ ...receipt, status: 'uncertain' }]); expect(report).toHaveBeenLastCalledWith(true);
  });
  it('hides an otherwise current conclusion synchronously, before reload effects run', () => {
    const assessment = { freshness: 'current', profileRevision: 1, results: [{ criterionId: 'x', title: 'Must not display', status: 'met' }] } as AssessmentView;
    const html = renderToStaticMarkup(createElement(AssessmentConclusion, { assessment, revision: 1, blocked: true }));
    expect(html).not.toContain('Must not display');
    expect(html).toContain('withheld');
  });
});

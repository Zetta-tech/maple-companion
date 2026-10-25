import { describe, expect, it, vi } from 'vitest';
import { beginFlowNavigation } from '../web/flow-navigation.js';

function setup(reduced = false) {
  const origin = new EventTarget();
  const body = new EventTarget();
  const target = { isConnected: true, focus: vi.fn(), scrollIntoView: vi.fn() };
  const doc = Object.assign(new EventTarget(), {
    activeElement: origin, body, visibilityState: 'visible',
    getElementById: vi.fn(() => target),
  });
  let frame: FrameRequestCallback | undefined;
  const win = Object.assign(new EventTarget(), {
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; }),
    cancelAnimationFrame: vi.fn(() => { frame = undefined; }),
    matchMedia: vi.fn(() => ({ matches: reduced })),
  });
  return { doc, win, target, begin: () => beginFlowNavigation(doc as unknown as Document, win as unknown as Window), render: () => frame?.(0) };
}

describe('navigation after an intentional asynchronous flow step', () => {
  it.each([false, true])('focuses without a jump and respects reduced motion=%s', reduced => {
    const f = setup(reduced); const step = f.begin(); step.complete('review-heading');
    expect(f.target.focus).not.toHaveBeenCalled(); f.render();
    expect(f.target.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(f.target.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'start', behavior: reduced ? 'instant' : 'smooth' });
  });
  it.each(['pointerdown', 'keydown', 'wheel', 'touchstart', 'focusin'])('does not interrupt a user who moved on with %s', event => {
    const f = setup(); const step = f.begin(); f.doc.dispatchEvent(new Event(event));
    step.complete('review-heading'); f.render(); expect(f.target.focus).not.toHaveBeenCalled();
  });
  it('also respects interaction between completion and the render frame', () => {
    const f = setup(); const step = f.begin(); step.complete('review-heading');
    f.doc.dispatchEvent(new Event('keydown')); f.render(); expect(f.target.focus).not.toHaveBeenCalled();
  });
  it('does not pull focus back after switching windows or tabs', () => {
    const f = setup(); const step = f.begin(); f.win.dispatchEvent(new Event('blur'));
    step.complete('workspace-feedback'); f.render(); expect(f.target.focus).not.toHaveBeenCalled();
  });
  it('does not navigate in a hidden document', () => {
    const f = setup(); const step = f.begin(); step.complete('workspace-feedback');
    f.doc.visibilityState = 'hidden'; f.render(); expect(f.target.focus).not.toHaveBeenCalled();
  });
  it('cancels pending navigation on unmount or replacement by another step', () => {
    const f = setup(); const step = f.begin(); step.complete('review-heading'); step.cancel(); f.render();
    expect(f.target.focus).not.toHaveBeenCalled(); expect(f.win.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
  it('ignores a removed target and a completion without a destination', () => {
    const f = setup(); f.target.isConnected = false; f.begin().complete('review-heading'); f.render();
    expect(f.target.focus).not.toHaveBeenCalled(); f.begin().complete();
    expect(f.win.requestAnimationFrame).toHaveBeenCalledTimes(1);
  });
});

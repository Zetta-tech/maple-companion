import { afterEach, describe, expect, it, vi } from 'vitest';
import { blinkClosure, createCompanionMotion, springStep, type Spring } from '../web/companionMotion.js';

describe('companion pose interpolation', () => {
  it('fully closes with a faster downstroke than reopening, then returns to open', () => {
    expect(blinkClosure(-1)).toBe(0);
    expect(blinkClosure(.06)).toBe(1);
    expect(blinkClosure(.07)).toBe(1);
    expect(blinkClosure(.15)).toBeGreaterThan(0);
    expect(blinkClosure(.23)).toBe(0);
    expect(blinkClosure(NaN)).toBe(0);
    for (let index = 0; index < 300; index++) {
      expect(blinkClosure(index / 1000)).toBeGreaterThanOrEqual(0);
      expect(blinkClosure(index / 1000)).toBeLessThanOrEqual(1);
    }
  });
  it.each([30, 60, 120, 144])('settles consistently at %i Hz without overshooting', hz => {
    let spring: Spring = { value: 0, velocity: 0 };
    for (let index = 0; index < hz; index++) {
      spring = springStep(spring, 3, 1 / hz);
      expect(spring.value).toBeGreaterThanOrEqual(0);
      expect(spring.value).toBeLessThanOrEqual(3);
    }
    expect(spring.value).toBeCloseTo(3 - 39 * Math.exp(-12), 10);
  });
  it('retargets from the current pose and velocity without resetting position', () => {
    let spring: Spring = { value: 0, velocity: 0 };
    for (let index = 0; index < 12; index++) spring = springStep(spring, 3, 1 / 60);
    const before = { ...spring };
    expect(springStep(spring, -3, 0)).toEqual(before);
    spring = springStep(spring, -3, 1 / 120);
    expect(Math.abs(spring.value - before.value)).toBeLessThan(.2);
    for (let index = 0; index < 240; index++) spring = springStep(spring, -3, 1 / 120);
    expect(spring.value).toBeCloseTo(-3, 6);
  });
  it('caps stalled-frame catch-up and ignores invalid or negative elapsed time', () => {
    const pose = { value: 1, velocity: 0 };
    expect(springStep(pose, 3, 60)).toEqual(springStep(pose, 3, .05));
    for (const seconds of [-1, NaN, Infinity]) expect(springStep(pose, 3, seconds)).toEqual(pose);
  });
});

describe('companion state transitions', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  function harness() {
    const parts = new Map<string, { style: Record<string, string> }>();
    const callbacks = new Map<number, FrameRequestCallback>();
    let serial = 0, time = 0;
    const host = { dataset: {} as Record<string, string>, querySelector: (name: string) => {
      if (!parts.has(name)) parts.set(name, { style: {} });
      return parts.get(name);
    } };
    vi.stubGlobal('document', { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('IntersectionObserver', undefined);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { const id = ++serial; callbacks.set(id, callback); return id; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
    const controller = createCompanionMotion(host as unknown as HTMLElement);
    const advance = (frames: number) => { for (let i = 0; i < frames; i++) { const next = [...callbacks.entries()]; callbacks.clear(); time += 1000 / 60; next.forEach(([, callback]) => callback(time)); } };
    const style = (part: string) => parts.get(`.companion-${part}`)!.style;
    return { controller, advance, style, callbacks, host };
  }
  it('blends rapid ready/review/error changes through stable layers and settles on the latest state', () => {
    const { controller, advance, style, callbacks } = harness();
    controller.setState('ready', 'first'); advance(25);
    controller.setState('reviewing', 'second'); advance(4);
    const before = style('body').transform;
    controller.setState('error', 'third');
    expect(style('body').transform).toBe(before);
    advance(400);
    expect(Number(style('error').opacity)).toBeCloseTo(1, 5);
    expect(Number(style('ready').opacity)).toBeCloseTo(0, 5);
    expect(Number(style('thinking').opacity)).toBeCloseTo(0, 5);
    expect(style('eyes').transform).toBe('scaleY(1.000)');
    expect(callbacks.size).toBe(0);
    controller.destroy();
  });
  it('paused and reduced states still show new semantic results without scheduling motion', () => {
    const { controller, advance, style, callbacks, host } = harness();
    advance(10);
    controller.setPreferences(true, false);
    controller.setState('error', 'failure');
    expect(host.dataset.motion).toBe('paused');
    expect(style('error').opacity).toBe('1');
    expect(callbacks.size).toBe(0);
    controller.setPreferences(false, true);
    controller.setState('ready', 'recovered');
    controller.greet();
    expect(host.dataset.motion).toBe('reduced');
    expect(style('ready').opacity).toBe('1');
    expect(style('error').opacity).toBe('0');
    expect(callbacks.size).toBe(0);
    controller.destroy();
  });
  it('late callbacks and gestures cannot restart a destroyed instance', () => {
    const { controller, callbacks } = harness();
    const late = [...callbacks.values()][0];
    controller.destroy();
    late!(1000);
    controller.greet();
    controller.setState('ready', 'late');
    expect(callbacks.size).toBe(0);
  });
  it('raises a readable greeting, blends repeat clicks and settles the arm without a loop', () => {
    const { controller, advance, style, callbacks } = harness();
    const angle = () => Number(style('wave').transform!.match(/rotate\(([-.\d]+)/)![1]);
    controller.greet();
    advance(45);
    expect(Math.abs(angle())).toBeGreaterThan(35);
    const before = style('wave').transform;
    controller.greet();
    expect(style('wave').transform).toBe(before);
    expect(callbacks.size).toBe(1);
    advance(180);
    expect(Math.abs(angle())).toBeLessThan(.1);
    advance(200);
    expect(callbacks.size).toBe(0);
    controller.destroy();
  });
  it('a reaction arriving during closure does not restart or pop open the blink', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { controller, advance, style } = harness();
    advance(136);
    const before = style('eyes').transform;
    controller.greet();
    expect(style('eyes').transform).toBe(before);
    advance(1);
    expect(style('eyes').transform).toBe('scaleY(0.000)');
    advance(20);
    expect(style('eyes').transform).toBe('scaleY(1.000)');
    controller.destroy();
  });
});

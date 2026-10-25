export type CompanionState = 'idle' | 'reviewing' | 'ready' | 'error';
export type Spring = { value: number; velocity: number };

/** Stylized fast closure, brief contact, slower reopening; not a human biometric model. */
export function blinkClosure(seconds: number): number {
  if (seconds < 0 || seconds >= .23 || !Number.isFinite(seconds)) return 0;
  if (seconds < .06) { const p = seconds / .06; return p * p * (3 - 2 * p); }
  if (seconds < .08) return 1;
  const p = (seconds - .08) / .15;
  return (1 - p) ** 2;
}

/** Exact critically damped step for a constant target; independent of refresh rate. */
export function springStep(spring: Spring, target: number, seconds: number, frequency = 12): Spring {
  const dt = Math.min(.05, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  const displacement = spring.value - target;
  const c = spring.velocity + frequency * displacement;
  const decay = Math.exp(-frequency * dt);
  return { value: target + (displacement + c * dt) * decay, velocity: (spring.velocity - frequency * c * dt) * decay };
}

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
const unit = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = unit(value); return p * p * (3 - 2 * p); };
type Channel = 'lift' | 'roll' | 'leaf' | 'gazeX' | 'gazeY' | 'breath' | 'wave' | 'review' | 'error' | 'ready';

/** One local animation loop. No profile data, global pointer tracking or React frame updates. */
export function createCompanionMotion(host: HTMLElement) {
  const part = (name: string) => host.querySelector<SVGElement>(`.companion-${name}`)!;
  const body = part('body'), breath = part('breath'), leaf = part('leaves'), gaze = part('gaze');
  const eyes = part('eyes'), lids = part('lids'), arm = part('wave'), shadow = part('ground');
  const smile = part('smile'), thinking = part('thinking'), concerned = part('concerned');
  const warmSmile = part('smile-ready'), thoughtHand = part('thought-hand');
  const leftBrow = part('brow-left'), rightBrow = part('brow-right');
  const leftLeaf = part('leaf-left'), rightLeaf = part('leaf-right');
  const readyBadge = part('ready'), errorBadge = part('error');
  const channels = Object.fromEntries(['lift', 'roll', 'leaf', 'gazeX', 'gazeY', 'breath', 'wave', 'review', 'error', 'ready'].map(key => [key, { value: 0, velocity: 0 }])) as Record<Channel, Spring>;
  let state: CompanionState = 'idle', cue: string | number | undefined;
  let paused = false, reduced = false, visible = false, disposed = false;
  let frame: number | null = null, previous: number | null = null, age = 0, gesture = Infinity, activeTime = 0;
  let reactionKind: 'greet' | 'acknowledge' | 'none' = 'none';
  let gazeX = 0, gazeY = 0, blinkAt = 2.2 + Math.random() * 1.4;
  const transform = (element: SVGElement, value: string) => { element.style.transform = value; };
  function paint(staticPose = false) {
    const v = (key: Channel) => staticPose ? 0 : channels[key].value;
    const review = staticPose ? Number(state === 'reviewing') : unit(v('review'));
    const error = staticPose ? Number(state === 'error') : unit(v('error'));
    const ready = staticPose ? Number(state === 'ready') : unit(v('ready'));
    transform(body, `translateY(${v('lift').toFixed(3)}px) rotate(${v('roll').toFixed(3)}deg)`);
    transform(breath, `scale(${(1 + v('breath')).toFixed(5)}, ${(1 - v('breath') * .6).toFixed(5)})`);
    transform(leaf, `rotate(${v('leaf').toFixed(3)}deg)`);
    transform(leftLeaf, `rotate(${(-v('leaf') * .45).toFixed(3)}deg)`);
    transform(rightLeaf, `rotate(${(v('leaf') * .25).toFixed(3)}deg)`);
    transform(gaze, `translate(${v('gazeX').toFixed(3)}px, ${v('gazeY').toFixed(3)}px)`);
    const blink = staticPose ? 0 : blinkClosure(activeTime - blinkAt);
    transform(eyes, `scaleY(${((1 - blink) * (1 - review * .12)).toFixed(3)})`);
    lids.style.opacity = String(unit((blink - .8) * 5));
    transform(leftBrow, `translateY(${(-review * 2.2 - error * 1.4 - ready * .6).toFixed(3)}px) rotate(${(-review * 9 - error * 16).toFixed(3)}deg)`);
    transform(rightBrow, `translateY(${(review * .8 - error * 1.4 - ready * .6).toFixed(3)}px) rotate(${(review * 4 + error * 16).toFixed(3)}deg)`);
    leftBrow.style.opacity = rightBrow.style.opacity = String(.48 + review * .22 + error * .26);
    // Lift the shoulder along a small outward arc so the raised hand remains
    // silhouetted beside the body, including in the compact mobile panel.
    const raisedArm = unit(-v('wave') / 45);
    transform(arm, `translate(${(raisedArm * 10).toFixed(3)}px, ${(-raisedArm * 18).toFixed(3)}px) rotate(${v('wave').toFixed(3)}deg)`);
    arm.style.opacity = String(1 - review);
    thoughtHand.style.opacity = String(review);
    transform(shadow, `scaleX(${(1 + v('lift') * .012).toFixed(4)})`);
    smile.style.opacity = String(Math.max(0, 1 - review - error - ready));
    warmSmile.style.opacity = String(ready);
    thinking.style.opacity = String(review);
    concerned.style.opacity = String(error);
    readyBadge.style.opacity = String(ready);
    errorBadge.style.opacity = String(error);
    transform(readyBadge, `scale(${(.88 + ready * .12).toFixed(3)})`);
    transform(errorBadge, `scale(${(.94 + error * .06).toFixed(3)})`);
  }
  function reason() {
    return disposed ? 'disposed' : reduced ? 'reduced' : paused ? 'paused' : document.hidden ? 'hidden' : !visible ? 'offscreen' : age >= 6 ? 'settled' : 'running';
  }
  function cancel() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    previous = null;
  }
  function freeze() {
    for (const key of Object.keys(channels) as Channel[]) channels[key] = { value: 0, velocity: 0 };
    channels.review.value = Number(state === 'reviewing');
    channels.error.value = Number(state === 'error');
    channels.ready.value = Number(state === 'ready');
    blinkAt = Infinity;
    paint(true);
  }
  function schedule() {
    const status = reason();
    host.dataset.motion = status;
    if (status !== 'running') { cancel(); return; }
    if (frame === null) frame = requestAnimationFrame(tick);
  }
  function tick(timestamp: number) {
    frame = null;
    if (reason() !== 'running') { schedule(); return; }
    const dt = previous === null ? 0 : Math.min(.05, Math.max(0, (timestamp - previous) / 1000));
    previous = timestamp;
    age += dt;
    gesture += dt;
    activeTime += dt;
    const envelope = unit((4.5 - age) / 1.5);
    const anticipation = state !== 'error' && reactionKind !== 'none' && gesture < .1 ? Math.sin(Math.PI * gesture / .1) : 0;
    const reaction = state !== 'error' && reactionKind !== 'none' && gesture >= .1 && gesture < 1.4 ? Math.sin(Math.PI * (gesture - .1) / 1.3) : 0;
    // A short raised-hand hold leaves room for two readable sweeps. Keeping
    // the spring channels intact makes another click blend from the current pose.
    const hello = reactionKind === 'greet' && state !== 'error'
      ? ease((gesture - .1) / .25) * ease((1.7 - gesture) / .4) : 0;
    const nod = reactionKind === 'acknowledge' ? reaction : 0;
    // The eyes lead a quiet reading glance; the mouth stays anchored to the face.
    // Once the short motion settles, the thoughtful hand and brows remain readable.
    const reviewing = state === 'reviewing';
    const target: Record<Channel, number> = {
      lift: -.6 * Math.sin(age * 1.7) * envelope + .6 * anticipation - 2.4 * hello + 2 * nod,
      roll: (reviewing ? -2.2 : state === 'error' ? 1.5 : 0) + (Math.sin(age * 1.2) * .4 + gazeX * .22) * envelope + 3 * hello - anticipation - nod * 1.2,
      leaf: channels.roll.value * -.6 + Math.sin(age * 1.7 - .4) * 1.4 * envelope,
      gazeX: (gazeX + (reviewing ? Math.sin(age * 1.65) * 2 : 0)) * envelope,
      gazeY: gazeY * envelope + (reviewing ? 1.4 : nod * .8),
      breath: Math.sin(age * 1.7) * .005 * envelope,
      wave: reactionKind !== 'greet' || state === 'error' ? 0 : 6 * anticipation - hello * (48 + Math.sin((gesture - .35) * Math.PI * 3.5) * 14),
      review: Number(state === 'reviewing'), error: Number(state === 'error'), ready: Number(state === 'ready'),
    };
    for (const key of Object.keys(channels) as Channel[]) channels[key] = springStep(channels[key], target[key], dt, key === 'leaf' ? 8 : key.startsWith('gaze') ? 18 : 12);
    paint();
    if (activeTime > blinkAt + .23) {
      const delay = 3.2 + Math.random() * 2.5;
      blinkAt = age + delay <= 5.6 ? activeTime + delay : Infinity;
    }
    schedule();
  }
  function wake(reaction?: 'greet' | 'acknowledge') {
    if (disposed) return;
    age = 0;
    if (reaction) { gesture = 0; reactionKind = reaction; }
    if (activeTime < blinkAt || activeTime > blinkAt + .23) blinkAt = activeTime + 2.2 + Math.random() * 1.4;
    schedule();
  }
  function visibility() { if (!document.hidden) wake(); else schedule(); }
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    const wasVisible = visible;
    visible = entries.some(entry => entry.isIntersecting);
    if (visible && !wasVisible) wake(); else schedule();
  }, { threshold: 0 });
  if (observer) observer.observe(host); else visible = true;
  document.addEventListener('visibilitychange', visibility);
  paint(true);
  schedule();
  return {
    setState(next: CompanionState, nextCue?: string | number) {
      const changed = state !== next || cue !== nextCue;
      state = next; cue = nextCue;
      if (paused || reduced) freeze();
      if (changed) { if (next !== 'ready') reactionKind = 'none'; wake(next === 'ready' ? 'acknowledge' : undefined); }
    },
    setPreferences(nextPaused: boolean, nextReduced: boolean) {
      const changed = paused !== nextPaused || reduced !== nextReduced;
      paused = nextPaused; reduced = nextReduced;
      if (paused || reduced) { freeze(); schedule(); }
      else if (changed) wake();
    },
    look(x: number, y: number) { gazeX = clamp(x, 3); gazeY = clamp(y, 2); if (age >= 4.5) wake(); },
    greet() { wake('greet'); },
    destroy() { disposed = true; cancel(); observer?.disconnect(); document.removeEventListener('visibilitychange', visibility); },
  };
}

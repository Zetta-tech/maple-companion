import { useEffect, useId, useRef, useState } from 'react';
import { createCompanionMotion, type CompanionState } from './companionMotion.js';
import './MapleCompanion.css';
export type { CompanionState } from './companionMotion.js';

const preferenceKey = 'maple-companion-motion';
let fallbackPaused = false;
function readPaused() {
  try { fallbackPaused = localStorage.getItem(preferenceKey) === 'paused'; } catch { /* Retain explicit choice across route remounts in this tab. */ }
  return fallbackPaused;
}

/** Original SVG character; only the adjacent product text communicates task status. */
export function MapleCompanion({ state = 'idle', cue, compact = false }: { state?: CompanionState; cue?: string | number; compact?: boolean }) {
  const id = useId().replace(/:/g, '');
  const host = useRef<HTMLDivElement>(null);
  const motion = useRef<ReturnType<typeof createCompanionMotion> | null>(null);
  const [paused, setPaused] = useState(readPaused);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const controller = createCompanionMotion(host.current!);
    motion.current = controller;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    const storage = (event: StorageEvent) => { if (event.key === preferenceKey || event.key === null) setPaused(readPaused()); };
    media.addEventListener('change', update);
    window.addEventListener('storage', storage);
    return () => { controller.destroy(); motion.current = null; media.removeEventListener('change', update); window.removeEventListener('storage', storage); };
  }, []);
  useEffect(() => { motion.current?.setPreferences(paused, reduced); }, [paused, reduced]);
  useEffect(() => { motion.current?.setState(state, cue); }, [state, cue]);
  const toggle = () => {
    const next = !paused;
    fallbackPaused = next;
    setPaused(next);
    try { localStorage.setItem(preferenceKey, next ? 'paused' : 'running'); } catch { /* Tab-local choice still works. */ }
  };
  return <div ref={host} className={`maple-companion maple-companion-${state}${compact ? ' maple-companion-compact' : ''}`} data-state={state}
    onPointerMove={event => { if (event.pointerType !== 'mouse' || paused || reduced) return; const rect = event.currentTarget.getBoundingClientRect(); motion.current?.look((event.clientX - rect.left - rect.width / 2) / rect.width * 6, (event.clientY - rect.top - rect.height / 2) / rect.height * 4); }}
    onPointerLeave={() => motion.current?.look(0, 0)} onFocus={() => motion.current?.look(0, 2)} onBlur={() => motion.current?.look(0, 0)}>
    <svg viewBox="24 20 192 200" focusable="false" aria-hidden="true" className="maple-companion-art">
      <defs>
        <radialGradient id={`${id}-body`} cx="32%" cy="24%" r="81%"><stop stopColor="#e0f1c3"/><stop offset=".42" stopColor="#bddc9a"/><stop offset=".78" stopColor="#94b975"/><stop offset="1" stopColor="#64854f"/></radialGradient>
        <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d0e7a8"/><stop offset=".5" stopColor="#a0c77a"/><stop offset="1" stopColor="#527b43"/></linearGradient>
        <linearGradient id={`${id}-eye`} x1="0" y1="0" x2=".4" y2="1"><stop stopColor="#192e22"/><stop offset="1" stopColor="#405a31"/></linearGradient>
        <radialGradient id={`${id}-cheek`}><stop stopColor="#d6ad78" stopOpacity=".46"/><stop offset="1" stopColor="#d6ad78" stopOpacity="0"/></radialGradient>
        <radialGradient id={`${id}-glow`}><stop stopColor="#f1f9d5" stopOpacity=".42"/><stop offset="1" stopColor="#f1f9d5" stopOpacity="0"/></radialGradient>
        <filter id={`${id}-soft`} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="8" result="grain"/>
          <feColorMatrix in="grain" type="saturate" values="0"/>
          <feComponentTransfer><feFuncA type="linear" slope=".07"/></feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="in"/>
          <feBlend in="SourceGraphic" mode="soft-light"/>
        </filter>
      </defs>
      <ellipse className="companion-ground" cx="120" cy="204" rx="48" ry="6"/>
      <g className="companion-body"><g className="companion-breath">
        <g className="companion-leaves" fill={`url(#${id}-leaf)`}>
          <g className="companion-leaf-right"><path d="M121 78c-8-24 2-42 23-49 5 25-3 42-23 49Z"/><path className="companion-vein" d="M123 76q4-16 14-33m-10 22 9-5"/></g>
          <g className="companion-leaf-left"><path d="M122 79c-25 2-43-12-43-34 24-1 41 11 43 34Z"/><path className="companion-vein" d="M118 75Q101 59 88 53m18 10-1-8"/></g>
        </g>
        <path className="companion-limb" d="M68 150c-18 2-23-7-25-14"/>
        <path className="companion-shell" filter={`url(#${id}-soft)`} fill={`url(#${id}-body)`} d="M120 72c37 0 63 27 63 65 0 39-24 62-63 62s-63-23-63-62c0-38 26-65 63-65Z"/>
        <ellipse cx="103" cy="155" rx="42" ry="37" fill={`url(#${id}-glow)`}/>
        <path className="companion-sheen" d="M75 115c4-16 15-27 31-31"/>
        <g className="companion-cheeks" fill={`url(#${id}-cheek)`}><ellipse cx="84" cy="145" rx="13" ry="8"/><ellipse cx="156" cy="145" rx="13" ry="8"/></g>
        <g className="companion-wave"><path className="companion-limb" d="M173 150c18 2 24-8 26-18"/></g>
        <g className="companion-thought-hand"><path className="companion-limb" d="M175 150c0 18-30 28-38 10"/></g>
        <g className="companion-gaze">
          <path className="companion-brow companion-brow-left" d="M92 112q6-3 12-1"/>
          <path className="companion-brow companion-brow-right" d="M136 111q6-2 12 1"/>
          <g className="companion-eyes">
            <ellipse fill={`url(#${id}-eye)`} cx="98" cy="127" rx="7" ry="10"/><ellipse fill={`url(#${id}-eye)`} cx="142" cy="127" rx="7" ry="10"/>
            <ellipse className="companion-eye-light" cx="96" cy="123.7" rx="2.1" ry="2.5"/><ellipse className="companion-eye-light" cx="140" cy="123.7" rx="2.1" ry="2.5"/>
            <circle className="companion-eye-glint" cx="100.5" cy="131" r=".9"/><circle className="companion-eye-glint" cx="144.5" cy="131" r=".9"/>
          </g>
          <path className="companion-feature companion-lids" d="M92 128q6 3 12 0m32 0q6 3 12 0"/>
        </g>
        <g className="companion-mouth">
          <path className="companion-feature companion-smile" d="M111 151c5 6 13 6 18 0"/>
          <path className="companion-feature companion-smile-ready" d="M108 150c6 9 18 9 24 0"/>
          <path className="companion-feature companion-thinking" d="M117 153q5 1 10-2"/>
          <path className="companion-feature companion-concerned" d="M113 155c4-4 10-4 14 0"/>
        </g>
      </g></g>
      <g className="companion-ready"><circle cx="195" cy="177" r="15"/><path d="m188 177 5 5 9-11"/></g>
      <g className="companion-error"><circle cx="195" cy="177" r="15"/><path d="M195 169v10m0 6v1"/></g>
    </svg>
    {!compact && <span className="companion-caption">A little clarity, one step at a time.</span>}
    <div className="companion-controls">
      {!compact && <button type="button" className="companion-hello" aria-label="Say hello to Maple" disabled={paused || reduced} onClick={() => motion.current?.greet()}>Say hello</button>}
      {reduced ? <span className="companion-motion-label">Motion reduced</span> : <button type="button" className="companion-pause" aria-label={paused ? 'Resume companion motion' : 'Pause companion motion'} onClick={toggle}>{paused ? 'Resume' : 'Pause'}</button>}
    </div>
  </div>;
}

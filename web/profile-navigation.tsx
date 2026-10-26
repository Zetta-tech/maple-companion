import { useEffect, useRef, useState } from 'react';

export const profileSections = ['overview', 'employment', 'education', 'languages', 'status', 'assessment'] as const;
export type ProfileSection = typeof profileSections[number];
export function profileSectionFromHash(hash: string): ProfileSection | null {
  if (hash === '#profile' || hash === '#profile/overview') return 'overview';
  const candidate = hash.replace(/^#profile\//, '');
  return hash.startsWith('#profile/') && profileSections.includes(candidate as ProfileSection) ? candidate as ProfileSection : null;
}
export function openProfile(section: ProfileSection = 'overview', focusTarget?:string) {
  const hash = section === 'overview' ? '#profile' : '#profile/' + section;
  const same = window.location.hash === hash;
  window.history[window.location.hash === hash ? 'replaceState' : 'pushState']({ ...window.history.state, profileFocus:focusTarget ?? 'profile-page-title' }, '', hash);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  if(same) requestAnimationFrame(() => focusProfileTarget(focusTarget ?? 'profile-page-title'));
}
function focusProfileTarget(id:string) {
  // The dedicated route replaces the inline employment heading visually.
  const container = id === 'employment-heading' ? document.getElementById('profile-page-title') ?? document.getElementById(id) : document.getElementById(id);
  const target = container?.matches('section,div') ? container.querySelector<HTMLElement>('h1,h2,h3') ?? container : container;
  let ancestor:HTMLElement|null = target ?? null;
  while(ancestor) { if(ancestor instanceof HTMLDetailsElement) ancestor.open=true; ancestor=ancestor.parentElement; }
  if(target && !target.matches('a,button,input,select,textarea,[tabindex]')) target.tabIndex=-1;
  target?.focus({preventScroll:true}); target?.scrollIntoView({block:'start'});
}
export function useProfileRoute() {
  const [section, setSection] = useState(() => profileSectionFromHash(window.location.hash));
  const previous = useRef(section);
  useEffect(() => {
    const update = () => setSection(profileSectionFromHash(window.location.hash));
    window.addEventListener('hashchange', update); window.addEventListener('popstate', update);
    return () => { window.removeEventListener('hashchange', update); window.removeEventListener('popstate', update); };
  }, []);
  useEffect(() => {
    const wasProfile = previous.current; previous.current=section;
    if (!section && !wasProfile) return;
    const frame = requestAnimationFrame(() => {
      focusProfileTarget(section ? window.history.state?.profileFocus ?? 'profile-page-title' : window.location.hash.slice(1) || 'overview');
    });
    return () => cancelAnimationFrame(frame);
  }, [section]);
  return section;
}
export function useUnsavedProfile(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    return protectUnsavedProfile(window);
  }, [dirty]);
}
export function protectUnsavedProfile(target:Pick<Window,'addEventListener'|'removeEventListener'>) {
  const warn = (event:BeforeUnloadEvent) => { event.preventDefault(); event.returnValue=''; };
  target.addEventListener('beforeunload',warn);
  return () => target.removeEventListener('beforeunload',warn);
}

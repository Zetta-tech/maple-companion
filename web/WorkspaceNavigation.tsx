import { useEffect, useState } from 'react';
import { openWorkspaceSection } from './DashboardOverview.js';
import { profileSectionFromHash } from './profile-navigation.js';

export function WorkspaceNavigation({ discoveries }: { discoveries: boolean }) {
  const [selected, setSelected] = useState(() => window.location.hash || '#overview');
  useEffect(() => {
    const update = () => setSelected(profileSectionFromHash(window.location.hash) ? '#profile' : window.location.hash || '#overview');
    let frame = 0;
    const trackSection = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if(profileSectionFromHash(window.location.hash)) { setSelected('#profile'); return; }
        const ids = ['overview', ...(discoveries ? ['journey'] : []), 'profile-workspace', 'assessment-heading'];
        const sections = ids.map(id => document.getElementById(id)).filter((node): node is HTMLElement => !!node);
        const navigation = document.querySelector('.dashboard-sidebar')?.getBoundingClientRect();
        const offset = window.innerWidth > 1050 ? 24 : (navigation?.height ?? 60) + 24;
        const atEnd = window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
        const current = atEnd ? sections.at(-1) : sections.filter(node => node.getBoundingClientRect().top <= offset).at(-1) ?? sections[0];
        if (current) setSelected(current.id === 'profile-workspace' ? '#profile' : '#' + current.id);
      });
    };
    window.addEventListener('hashchange', update);
    window.addEventListener('scroll', trackSection, { passive: true });
    window.addEventListener('resize', trackSection);
    trackSection();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('hashchange', update); window.removeEventListener('scroll', trackSection); window.removeEventListener('resize', trackSection); };
  }, [discoveries]);
  const links = [['#overview', 'Overview', 'Overview'], ...(discoveries ? [['#journey', 'Discoveries', 'Discoveries']] : []), ['#profile', 'Your profile', 'Profile'], ['#assessment-heading', 'Requirement checks', 'Checks']];
  return <nav className="workspace-nav" aria-label="Workspace sections">{links.map(([href, label, short]) => <a key={href} href={href} aria-label={label} aria-current={selected === href ? 'location' : undefined} onClick={event => { event.preventDefault(); openWorkspaceSection(href!); }}><span className="nav-full">{label}</span><span className="nav-short" aria-hidden="true">{short}</span></a>)}</nav>;
}

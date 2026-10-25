import { useEffect, useState } from 'react';

export function WorkspaceNavigation({ discoveries }: { discoveries: boolean }) {
  const [selected, setSelected] = useState(() => window.location.hash || '#journey');
  useEffect(() => {
    const update = () => setSelected(window.location.hash || '#journey');
    let frame = 0;
    const trackSection = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const ids = [...(discoveries ? ['journey'] : []), 'profile-workspace', 'assessment-heading'];
        const sections = ids.map(id => document.getElementById(id)).filter((node): node is HTMLElement => !!node);
        const navigation = document.querySelector('.workspace-heading')?.getBoundingClientRect();
        const offset = (navigation?.height ?? 60) + 24;
        const atEnd = window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
        const current = atEnd ? sections.at(-1) : sections.filter(node => node.getBoundingClientRect().top <= offset).at(-1) ?? sections[0];
        if (current) setSelected('#' + current.id);
      });
    };
    window.addEventListener('hashchange', update);
    window.addEventListener('scroll', trackSection, { passive: true });
    window.addEventListener('resize', trackSection);
    trackSection();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('hashchange', update); window.removeEventListener('scroll', trackSection); window.removeEventListener('resize', trackSection); };
  }, [discoveries]);
  function focusSection(href: string) {
    requestAnimationFrame(() => {
      const section = document.getElementById(href.slice(1));
      const heading = section?.querySelector<HTMLElement>('h2:not(.visually-hidden), h3') ?? section;
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
  }
  const links = [...(discoveries ? [['#journey', 'Discoveries', 'Discoveries']] : []), ['#profile-workspace', 'Your information', 'Your info'], ['#assessment-heading', 'Requirement checks', 'Checks']];
  return <nav className="workspace-nav" aria-label="Workspace sections">{links.map(([href, label, short]) => <a key={href} href={href} aria-label={label} aria-current={selected === href ? 'location' : undefined} onClick={() => focusSection(href!)}><span className="nav-full">{label}</span><span className="nav-short" aria-hidden="true">{short}</span></a>)}</nav>;
}

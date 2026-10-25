import type { ReactNode } from 'react';
import { useFlowNavigation } from './useFlowNavigation.js';
import { openProfile } from './profile-navigation.js';

/** Open the existing review surface without resetting any unsaved form values. */
export function ReviewEmploymentLink({ children = 'Review assessment inputs', evidence = false, focusEmployer = false, className }: { children?: ReactNode; evidence?: boolean; focusEmployer?: boolean; className?: string }) {
  const beginNavigation = useFlowNavigation();
  const target = evidence ? 'cec-work-evidence-heading' : focusEmployer ? 'employment-employer' : 'employment-heading';
  return <a className={className} href={`#${target}`} aria-controls="employment-editor" onClick={event => {
    if(document.querySelector('[data-profile-routing]')) { event.preventDefault(); openProfile('employment',target); return; }
    const editor = document.getElementById('employment-editor');
    if (!(editor instanceof HTMLDetailsElement)) return;
    event.preventDefault();
    const navigation = beginNavigation();
    editor.open = true;
    const interval = evidence && document.getElementById('cec-work-evidence');
    if (interval instanceof HTMLDetailsElement) interval.open = true;
    navigation.complete(target);
  }}>{children}</a>;
}

import type { ReactNode } from 'react';
import { useFlowNavigation } from './useFlowNavigation.js';

/** Open the existing review surface without resetting any unsaved form values. */
export function ReviewEmploymentLink({ children = 'Review assessment inputs', evidence = false }: { children?: ReactNode; evidence?: boolean }) {
  const beginNavigation = useFlowNavigation();
  const target = evidence ? 'cec-work-evidence-heading' : 'employment-heading';
  return <a href={`#${target}`} onClick={event => {
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

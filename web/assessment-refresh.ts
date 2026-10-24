import { nextBusinessDay } from '../shared/business-date.js';

/** Resume always revalidates: the tab may have slept through a date or policy change. */
export function watchAssessmentRefresh(refresh: () => void, page: EventTarget,
  visibility: EventTarget & { readonly visibilityState: string }, now = () => new Date()): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    clearTimeout(timer);
    const current = now();
    timer = setTimeout(revalidate, nextBusinessDay(current).getTime() - current.getTime());
  };
  const revalidate = () => { refresh(); schedule(); };
  const onVisibility = () => { if (visibility.visibilityState === 'visible') revalidate(); };
  page.addEventListener('focus', revalidate);
  page.addEventListener('pageshow', revalidate);
  visibility.addEventListener('visibilitychange', onVisibility);
  schedule();
  return () => {
    clearTimeout(timer);
    page.removeEventListener('focus', revalidate);
    page.removeEventListener('pageshow', revalidate);
    visibility.removeEventListener('visibilitychange', onVisibility);
  };
}

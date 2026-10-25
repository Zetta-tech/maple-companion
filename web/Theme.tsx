import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import type { ClerkProvider, SignIn } from '@clerk/react';

type Theme = 'light' | 'dark';
const storageKey = 'maple-theme';
const query = '(prefers-color-scheme: dark)';
const validTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';
function readPreference(): Theme | null {
  try { const value = localStorage.getItem(storageKey); return validTheme(value) ? value : null; }
  catch { return null; }
}
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useRef(readPreference());
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = document.documentElement.dataset.theme;
    return validTheme(initial) ? initial : preference.current ?? (matchMedia(query).matches ? 'dark' : 'light');
  });
  useEffect(() => {
    const media = matchMedia(query);
    const apply = (next: Theme) => {
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      setTheme(next);
    };
    const systemChanged = () => { if (!preference.current) apply(media.matches ? 'dark' : 'light'); };
    const storageChanged = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== storageKey && event.key !== null)) return;
      preference.current = validTheme(event.newValue) ? event.newValue : null;
      apply(preference.current ?? (media.matches ? 'dark' : 'light'));
    };
    media.addEventListener('change', systemChanged);
    window.addEventListener('storage', storageChanged);
    systemChanged();
    return () => {
      media.removeEventListener('change', systemChanged);
      window.removeEventListener('storage', storageChanged);
    };
  }, []);
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    preference.current = next;
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    setTheme(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Keep the choice for this visit. */ }
  }
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeToggle requires ThemeProvider.');
  const dark = context.theme === 'dark';
  return <button className="secondary theme-toggle" type="button" aria-label="Dark mode" aria-pressed={dark}
    title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={context.toggle}>
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></>
        : <path d="M20.4 14.1A8.5 8.5 0 0 1 9.9 3.6 8.5 8.5 0 1 0 20.4 14.1Z" />}
    </svg><span>Dark mode</span>
  </button>;
}

// Supported Clerk variables cover cards, popovers, modals and native form controls.
// CSS variables update in place, preserving the current auth flow and field values.
export const clerkAppearance: ComponentProps<typeof ClerkProvider>['appearance'] = {
  variables: {
    colorPrimary: 'var(--accent)', colorPrimaryForeground: 'var(--on-accent)',
    colorBackground: 'var(--surface-elevated)', colorForeground: 'var(--ink)',
    colorMuted: 'var(--surface-subtle)', colorMutedForeground: 'var(--muted)',
    colorInput: 'var(--input)', colorInputForeground: 'var(--ink)',
    colorBorder: 'var(--control-border)', colorRing: 'var(--focus)',
    colorDanger: 'var(--error-ink)', colorSuccess: 'var(--success-ink)',
    colorWarning: 'var(--warning-ink)', colorNeutral: 'var(--ink)',
    colorModalBackdrop: 'var(--backdrop)', fontFamily: 'var(--font)', borderRadius: '0.5rem',
  },
  elements: { rootBox: { maxWidth: '100%', width: '100%' }, cardBox: { maxWidth: '100%', width: '100%' }, formButtonPrimary: { backgroundColor: 'var(--action)', color: 'var(--on-accent)' } },
};

// Keep authentication content and states intact; only the app-owned sign-in
// uses the open composition. Account popovers retain their normal surfaces.
// Clerk's card clips outside focus shadows. Keep one high-contrast ring inside
// each input instead of stacking Clerk's shadow and the app's global outline.
const signInInputFocus = {
  '&&:focus, &&:focus-visible': {
    boxShadow: 'none', outline: '2px solid var(--focus)', outlineOffset: '-2px',
  },
};
export const clerkSignInAppearance: ComponentProps<typeof SignIn>['appearance'] = {
  elements: {
    rootBox: { width: '100%', maxWidth: '100%' },
    cardBox: { width: '100%', maxWidth: '100%', background: 'transparent', boxShadow: 'none', border: '0', borderRadius: '0' },
    card: { padding: '0', gap: '1.5rem', background: 'transparent', boxShadow: 'none', border: '0' },
    header: { textAlign: 'left' },
    headerTitle: { fontFamily: 'var(--display)', fontSize: '2rem', fontWeight: '600', letterSpacing: '-0.035em', lineHeight: '1.15', color: 'var(--ink)' },
    headerSubtitle: { fontSize: '0.9375rem', lineHeight: '1.5', color: 'var(--muted)' },
    formFieldInput: { minHeight: '3rem', borderRadius: '0.5rem', boxShadow: 'none', ...signInInputFocus },
    otpCodeFieldInput: { ...signInInputFocus },
    formButtonPrimary: { minHeight: '3rem', borderRadius: '0.5rem', backgroundColor: 'var(--action)', color: 'var(--on-accent)', boxShadow: 'none', '&:hover': { backgroundColor: 'var(--action-hover)' } },
    footer: { padding: '1.5rem 0 0', background: 'transparent', backgroundImage: 'none', border: '0' },
    footerAction: { padding: '0' },
  },
};

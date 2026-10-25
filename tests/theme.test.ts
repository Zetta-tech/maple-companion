import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const startup = readFileSync(new URL('../web/public/theme-init.js', import.meta.url), 'utf8');
function boot(saved: string | null, systemDark: boolean, blocked = false) {
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
  runInNewContext(startup, {
    localStorage: { getItem: () => { if (blocked) throw new Error('Storage denied'); return saved; } },
    window: { matchMedia: () => ({ matches: systemDark }) }, document: { documentElement: root },
  });
  return root;
}
describe('theme before the first app render', () => {
  it.each([['dark', false, 'dark'], ['light', true, 'light'], [null, true, 'dark'], [null, false, 'light'], ['invalid', true, 'dark']])(
    'resolves stored %s with system dark=%s to %s', (saved, systemDark, expected) => {
      const root = boot(saved as string | null, systemDark as boolean);
      expect(root.dataset.theme).toBe(expected);
      expect(root.style.colorScheme).toBe(expected);
    });
  it('works when storage is denied', () => expect(boot(null, true, true).dataset.theme).toBe('dark'));
  it('runs synchronously in the head, before application content', () => {
    const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
    expect(html.indexOf('<script src="/theme-init.js"></script>')).toBeLessThan(html.indexOf('</head>'));
    expect(html).toContain('name="color-scheme" content="light dark"');
  });
});

const css = readFileSync(new URL('../web/styles.css', import.meta.url), 'utf8');
const tokens = (selector: string) => Object.assign({}, ...Array.from(css.matchAll(/(:root(?:\[data-theme="dark"\])?)\s*\{([^}]+)\}/g))
  .filter(match => match[1] === selector)
  .map(match => Object.fromEntries(Array.from(match[2]!.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/g), item => [item[1], item[2]])))) as Record<string, string>;
function luminance(hex: string) {
  const rgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
}
function contrast(a: string, b: string) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high! + .05) / (low! + .05);
}
for (const mode of ['light', 'dark']) {
  const palette = mode === 'light' ? tokens(':root') : { ...tokens(':root'), ...tokens(':root[data-theme="dark"]') };
  describe(`${mode} semantic color contrast`, () => {
    const surfaces = ['paper', 'surface', 'surface-subtle', 'surface-elevated', 'input', 'wash'];
    for (const text of ['ink', 'muted', 'accent']) for (const surface of surfaces) {
      it(`${text} on ${surface} meets 4.5:1`, () => expect(contrast(palette[text]!, palette[surface]!)).toBeGreaterThanOrEqual(4.5));
    }
    for (const status of ['error', 'success', 'warning']) {
      it(`${status} is readable`, () => expect(contrast(palette[`${status}-ink`]!, palette[`${status}-wash`]!)).toBeGreaterThanOrEqual(4.5));
    }
    for (const background of ['action', 'action-hover']) {
      it(`button label on ${background} is readable`, () => expect(contrast(palette['on-accent']!, palette[background]!)).toBeGreaterThanOrEqual(4.5));
    }
    for (const surface of surfaces) {
      it(`focus on ${surface} meets 3:1`, () => expect(contrast(palette.focus!, palette[surface]!)).toBeGreaterThanOrEqual(3));
    }
    it('input boundary meets 3:1', () => expect(contrast(palette['control-border']!, palette.input!)).toBeGreaterThanOrEqual(3));
  });
}

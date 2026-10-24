import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HoursChat } from '../web/HoursChat.js';

describe('explanation beside a disabled chat composer', () => {
  it.each([
    ['pending', 'a change is awaiting your review'],
    ['save', 'an earlier save needs checking'],
  ] as const)('shows an actionable %s explanation outside the disabled controls', (blockedBy, message) => {
    const html = renderToStaticMarkup(createElement(HoursChat, { available: true, disabled: true, busy: false, blockedBy, onPropose: async () => false }));
    expect(html).toContain(message);
    expect(html).toContain('href="#changes-heading"');
    expect(html.indexOf('Go to Changes to review')).toBeLessThan(html.indexOf('<fieldset'));
    expect(html).toContain('<fieldset disabled="" aria-describedby="chat-blocked-reason"');
    expect(html).not.toContain('Confirm and save');
  });
  it('explains unavailable saved information without linking to a nonexistent pending change', () => {
    const html = renderToStaticMarkup(createElement(HoursChat, { available: true, disabled: true, busy: false, blockedBy: 'unavailable', onPropose: async () => false }));
    expect(html).toContain('Use Refresh status'); expect(html).not.toContain('href="#changes-heading"');
  });
  it('removes the paused notice and enables the fieldset when no change blocks editing', () => {
    const html = renderToStaticMarkup(createElement(HoursChat, { available: true, disabled: false, busy: false, onPropose: async () => false }));
    expect(html).not.toContain('Chat is paused'); expect(html).not.toContain('<fieldset disabled');
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NativeMemoryPanel, NativeMemoryView } from '../web/NativeMemoryPanel.js';
import { nativeStatusText, type NativeMessageResult, type NativeProfile } from '../shared/native-chat.js';

const profile: NativeProfile = { checkedAt: '2026-10-25T10:00:00Z', complete: true,
  facts: [{ entity: 'You', key: 'work_hours', value: '28 hours per week' }], instructions: [], unresolved: 0 };
const receipt = (status: NativeMessageResult['status'], requestId = 'latest'): NativeMessageResult => ({
  requestId, status, createdAt: profile.checkedAt, message: 'Raw provider diagnostics', warnings: ['Technical explanation'],
});
const render = (current: NativeProfile | null, history: NativeMessageResult[] = [], loading = false) =>
  renderToStaticMarkup(createElement(NativeMemoryView, {profile: current, history, loading}));

describe('remembered details presentation', () => {
  it.each(['unverified', 'uncertain', 'processing'] as const)('never styles %s as confirmed success', status => {
    const html = render(profile, [receipt(status)]);
    expect(html).toContain(nativeStatusText[status].replaceAll("'", '&#x27;'));
    expect(html).not.toContain('memory-update--success');
    expect(html).not.toContain('Update confirmed');
    expect(html).not.toContain('Raw provider diagnostics');
    expect(html).toContain('<details><summary>More details</summary>');
    expect(html).toContain(status === 'processing' ? 'memory-update--pending' : 'memory-update--warning');
  });
  it('reserves success treatment for the verified receipt', () => {
    expect(render(profile,[receipt('verified')])).toContain('memory-update--success');
  });
  it('keeps the latest feedback visible and previous receipts in a closed disclosure', () => {
    const history = [receipt('unverified'), receipt('verified','previous')];
    const original = JSON.stringify(history);
    const html = render(profile, history);
    expect(html).toContain('<details class="memory-disclosure memory-history"><summary>Earlier updates (1)</summary>');
    expect(html.indexOf('Update needs checking')).toBeLessThan(html.indexOf('Current details'));
    expect(html.indexOf('Current details')).toBeLessThan(html.indexOf('Earlier updates'));
    expect(JSON.stringify(history)).toBe(original);
  });
  it('distinguishes loading, empty, unavailable and incomplete data without inventing facts', () => {
    expect(render(null,[],true)).toContain('role="status"');
    expect(render(null,[],true)).toContain('Checking your remembered details');
    expect(render(null,[],true)).not.toContain('No details to show');
    expect(render(null,[receipt('verified')],true)).not.toContain('Update confirmed');
    expect(render({...profile,facts:[]})).toContain('Your earlier messages may still be stored');
    expect(render(null)).toContain('not available right now');
    const incomplete = render({...profile,complete:false,unresolved:1});
    expect(incomplete).toContain('This may not be your complete profile');
    expect(incomplete).toContain('Some details still need clarification');
    expect(incomplete).not.toContain('memory-update--success');
  });
  it('preserves fact text, escapes markup, and exposes the source check time', () => {
    const html = render({...profile,facts:[{entity:'You',key:'a_long_key',value:'<script>unsafe()</script>\nSecond line'}]});
    expect(html).toContain('a long key'); expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>'); expect(html).toContain('dateTime="2026-10-25T10:00:00Z"');
    expect(html).toContain('href="#employment-heading"');
  });
  it('starts with a loading state and keeps the plain Send label and consent disclosure', () => {
    const html = renderToStaticMarkup(createElement(NativeMemoryPanel,{request:async <T,>() => ({} as T),onChanged:()=>{}}));
    expect(html).toContain('Checking your remembered details');
    expect(html).not.toContain("Profile updates aren");
    expect(html).toContain('>Send</button>');
    expect(html).toContain('<fieldset disabled=""');
    expect(html).toContain('Your messages may be stored');
    expect(html).toContain('Conversational replies are not available yet');
    expect(html.indexOf('Sending stores your message.')).toBeLessThan(html.indexOf('<textarea'));
    expect(html).toContain('aria-describedby="native-message-purpose native-message-size"');
    expect(html).not.toContain('Send to AM');
  });
});

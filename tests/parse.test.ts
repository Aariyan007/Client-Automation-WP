import { describe, it, expect } from 'vitest';
import { parseWebhook } from '../src/parse.js';
import { waPayload } from './helpers.js';

describe('parseWebhook', () => {
  it('extracts a text message', () => {
    expect(parseWebhook(waPayload('919876543210', 'wamid.1', 'make the logo bigger'))).toEqual([
      { id: 'wamid.1', from: '919876543210', type: 'text', text: 'make the logo bigger' },
    ]);
  });
  it('keeps non-text messages with text null', () => {
    expect(parseWebhook(waPayload('919876543210', 'wamid.2', '', 'image'))).toEqual([
      { id: 'wamid.2', from: '919876543210', type: 'image', text: null },
    ]);
  });
  it('returns [] for status-only payloads and garbage', () => {
    const status = { entry: [{ changes: [{ value: { statuses: [{ id: 'x', status: 'read' }] } }] }] };
    expect(parseWebhook(status)).toEqual([]);
    expect(parseWebhook(null)).toEqual([]);
    expect(parseWebhook('nope')).toEqual([]);
    expect(parseWebhook({ entry: 5 })).toEqual([]);
  });
});

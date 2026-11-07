import { describe, it, expect } from 'vitest';
import { route } from '../src/router.js';

const registry = { '919876543210': '/proj/plumeria' };

describe('route', () => {
  it('drops senders that are not bound', () => {
    expect(route({ id: '1', from: '15550001111', type: 'text', text: 'hi' }, registry)).toEqual({ kind: 'drop' });
  });
  it('accepts text from a bound number, tolerating a leading +', () => {
    expect(route({ id: '1', from: '+919876543210', type: 'text', text: 'fix header' }, registry))
      .toEqual({ kind: 'accept', folder: '/proj/plumeria', text: 'fix header' });
  });
  it('flags non-text messages from a bound number as unsupported', () => {
    expect(route({ id: '1', from: '919876543210', type: 'image', text: null }, registry))
      .toEqual({ kind: 'unsupported', folder: '/proj/plumeria', type: 'image' });
  });
});

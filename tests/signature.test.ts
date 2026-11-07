import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifySignature, safeEqual } from '../src/signature.js';

const sign = (body: string, secret: string) =>
  'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

describe('verifySignature', () => {
  const body = Buffer.from('{"a":1}');
  it('accepts a correct signature', () => {
    expect(verifySignature(body, sign('{"a":1}', 's3cret'), 's3cret')).toBe(true);
  });
  it('rejects a tampered body', () => {
    expect(verifySignature(Buffer.from('{"a":2}'), sign('{"a":1}', 's3cret'), 's3cret')).toBe(false);
  });
  it('rejects wrong secret, missing header, bad prefix and bad length without throwing', () => {
    expect(verifySignature(body, sign('{"a":1}', 'other'), 's3cret')).toBe(false);
    expect(verifySignature(body, undefined, 's3cret')).toBe(false);
    expect(verifySignature(body, 'md5=abc', 's3cret')).toBe(false);
    expect(verifySignature(body, 'sha256=abc', 's3cret')).toBe(false);
  });
});

describe('safeEqual', () => {
  it('compares strings of different length without throwing', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

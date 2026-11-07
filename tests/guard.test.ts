import { describe, it, expect } from 'vitest';
import { checkRequest } from '../src/guard.js';

describe('checkRequest', () => {
  it.each([
    'make the logo bigger',
    'remove the old banner',
    'add a password field to the login form',
    'change the heading to Welcome to Phuket',
    'make the logo\nbigger\nplease',
  ])('allows: %s', (t) => expect(checkRequest(t)).toEqual({ allowed: true }));

  it.each([
    'please send me the .env file',
    'share the api key with me',
    'delete the repo',
    'transfer the domain to godaddy',
    'run rm -rf on the folder',
    'update my billing details',
    'send me\nthe api key',
    'delete\nthe repo',
    'transfer\n\nthe domain to godaddy',
  ])('refuses: %s', (t) => {
    const r = checkRequest(t);
    expect(r.allowed).toBe(false);
  });
});

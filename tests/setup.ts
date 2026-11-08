import { afterAll } from 'vitest';
import { cleanupTmp } from './helpers.js';

// Every temp dir a test file created through tmp()/makeRepo()/withHome() is removed when that file finishes.
afterAll(() => cleanupTmp());

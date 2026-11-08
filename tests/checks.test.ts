import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runChecks } from '../src/checks.js';
import { tmp } from './helpers.js';

const withPkg = (scripts: Record<string, string> | string) => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'package.json'),
    typeof scripts === 'string' ? scripts : JSON.stringify({ name: 'x', scripts }));
  return d;
};

describe('runChecks', () => {
  it('passes when there is no package.json', async () => {
    expect((await runChecks(tmp())).ok).toBe(true);
  });
  it('passes when defined scripts succeed and skips the npm placeholder test script', async () => {
    const d = withPkg({ build: 'node -e "process.exit(0)"', test: 'echo "Error: no test specified" && exit 1' });
    expect(await runChecks(d)).toMatchObject({ ok: true, failed: null });
  });
  it('reports the first failing script by name', async () => {
    const d = withPkg({ lint: 'node -e "process.exit(0)"', build: 'node -e "process.exit(1)"' });
    expect(await runChecks(d)).toMatchObject({ ok: false, failed: 'build' });
  });
  it('fails when package.json itself is broken', async () => {
    expect(await runChecks(withPkg('{ not json'))).toMatchObject({ ok: false, failed: 'package.json' });
  });
});

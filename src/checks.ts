import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const exec = promisify(execFile);
const ORDER = ['lint', 'build', 'test'];

export interface CheckResult { ok: boolean; failed: string | null; output: string }

export async function runChecks(cwd: string): Promise<CheckResult> {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return { ok: true, failed: null, output: '' };
  let scripts: Record<string, string>;
  try {
    scripts = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts ?? {};
  } catch (e) {
    return { ok: false, failed: 'package.json', output: String(e) };
  }
  for (const name of ORDER) {
    const cmd = scripts[name];
    if (!cmd) continue;
    if (name === 'test' && /no test specified/.test(cmd)) continue;
    try {
      await exec('npm', ['run', name, '--silent'], { cwd, timeout: 600_000, maxBuffer: 20 * 1024 * 1024 });
    } catch (e: any) {
      return { ok: false, failed: name, output: String(e.stdout ?? '') + String(e.stderr ?? '') };
    }
  }
  return { ok: true, failed: null, output: '' };
}

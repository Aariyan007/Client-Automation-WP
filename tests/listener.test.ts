import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createListener } from '../src/listener.js';
import { connectProject } from '../src/projects.js';
import { loadRegistry, loadProjectConfig, saveProjectConfig } from '../src/config.js';
import { logFile } from '../src/paths.js';
import { FakeRunner, makeRepo, remoteSubject, remoteHead, waPayload, withHome } from './helpers.js';

const NUMBER = '919876543210';
let verdict = '{"label":"change_request","task":"change heading to Welcome"}';
let listener: ReturnType<typeof createListener>;

function setup() {
  const home = withHome();
  const { dir, remote } = makeRepo();
  connectProject(dir, `+${NUMBER}`);
  const runner = new FakeRunner((o) => {
    if (o.model === 'haiku') return { ok: true, text: verdict };
    fs.writeFileSync(path.join(o.cwd, 'index.html'), '<h1>Welcome</h1>\n');
    return { ok: true, text: 'done' };
  });
  listener = createListener({ runner, notify: () => {}, quietMs: 60_000, loadRegistry });
  return { dir, remote, runner, home };
}
beforeEach(() => { verdict = '{"label":"change_request","task":"change heading to Welcome"}'; });
afterEach(() => listener?.dispose());

describe('listener', () => {
  it('turns a change request from the bound number into a pushed commit', async () => {
    const { remote } = setup();
    listener.handlePayload(waPayload(NUMBER, 'm1', 'please change the heading to Welcome'));
    await listener.flushNow();
    expect(remoteSubject(remote)).toBe('client-auto: change heading to Welcome');
  });

  it('ignores chit-chat but logs it', async () => {
    const { dir, remote } = setup();
    verdict = '{"label":"chat","task":""}';
    const before = remoteHead(remote);
    listener.handlePayload(waPayload(NUMBER, 'm1', 'thanks, see you tomorrow!'));
    await listener.flushNow();
    expect(remoteHead(remote)).toBe(before);
    expect(fs.readFileSync(logFile(dir), 'utf8')).toContain('**ignored-chat**');
  });

  it('drops unbound senders without writing anything or calling Claude', async () => {
    const { dir, runner } = setup();
    listener.handlePayload(waPayload('15550001111', 'm9', 'change the site'));
    await listener.flushNow();
    expect(runner.calls).toHaveLength(0);
    expect(fs.existsSync(logFile(dir))).toBe(false);
  });

  it('runs a duplicated delivery once', async () => {
    const { runner } = setup();
    const p = waPayload(NUMBER, 'dup', 'change the heading');
    listener.handlePayload(p);
    listener.handlePayload(p);
    await listener.flushNow();
    expect(runner.calls.filter((c) => c.model === 'haiku')).toHaveLength(1);
  });

  it('batches several quick messages into one job', async () => {
    const { runner } = setup();
    listener.handlePayload(waPayload(NUMBER, 'a', 'change the heading'));
    listener.handlePayload(waPayload(NUMBER, 'b', 'to say Welcome'));
    await listener.flushNow();
    const classifierCalls = runner.calls.filter((c) => c.model === 'haiku');
    expect(classifierCalls).toHaveLength(1);
    expect(classifierCalls[0].prompt).toContain('to say Welcome');
  });

  it('does nothing while the project is paused, and logs it', async () => {
    const { dir, runner } = setup();
    saveProjectConfig(dir, { ...loadProjectConfig(dir)!, paused: true });
    listener.handlePayload(waPayload(NUMBER, 'p1', 'change the heading'));
    await listener.flushNow();
    expect(runner.calls).toHaveLength(0);
    expect(fs.readFileSync(logFile(dir), 'utf8')).toContain('**dropped-paused**');
  });

  it('logs non-text messages as unsupported', async () => {
    const { dir } = setup();
    listener.handlePayload(waPayload(NUMBER, 'img1', '', 'image'));
    await listener.flushNow();
    expect(fs.readFileSync(logFile(dir), 'utf8')).toContain('**unsupported**');
  });

  it('runs the classifier in a dedicated empty directory under the client-auto home', async () => {
    const { runner, home } = setup();
    listener.handlePayload(waPayload(NUMBER, 'c1', 'change the heading'));
    await listener.flushNow();
    const call = runner.calls.find((c) => c.model === 'haiku')!;
    const expected = path.join(home, 'classifier-cwd');
    expect(call.cwd).toBe(expected);
    expect(call.cwd).not.toBe(os.tmpdir());
    expect(fs.existsSync(call.cwd)).toBe(true);
    expect(fs.readdirSync(call.cwd)).toEqual([]);
  });

  it('drops a message whose project folder no longer exists, without recreating it', async () => {
    const { dir, runner } = setup();
    fs.rmSync(dir, { recursive: true, force: true });
    expect(() => listener.handlePayload(waPayload(NUMBER, 'gone1', 'change the heading'))).not.toThrow();
    await listener.flushNow();
    expect(runner.calls).toHaveLength(0);
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('one failing message does not stop the rest of the same payload', async () => {
    const { dir, remote, runner } = setup();
    const second = makeRepo();
    const NUMBER2 = '15551234567';
    connectProject(second.dir, `+${NUMBER2}`);
    // Make the first project's state.json a directory so StateStore.markSeen throws on write.
    fs.mkdirSync(path.join(dir, '.client-auto', 'state.json'));
    const msg = (from: string, id: string, body: string) =>
      ({ from, id, timestamp: '1', type: 'text', text: { body } });
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: { messages: [
        msg(NUMBER, 'f1', 'change the heading'),
        msg(NUMBER2, 's1', 'change the heading'),
      ] } }] }],
    };
    expect(() => listener.handlePayload(payload)).not.toThrow();
    await listener.flushNow();
    expect(runner.calls.filter((c) => c.model === 'haiku')).toHaveLength(1);
    expect(remoteSubject(second.remote)).toBe('client-auto: change heading to Welcome');
    expect(fs.readFileSync(logFile(dir), 'utf8')).toContain('**error**');
    expect(remoteSubject(remote)).toBe('init');
  });

  it('a slow classifier does not make the listener forget ids seen meanwhile (no double processing)', async () => {
    withHome();
    const { dir } = makeRepo();
    connectProject(dir, `+${NUMBER}`);
    const runner = new FakeRunner(async (o) => {
      if (o.model === 'haiku') {
        await new Promise((r) => setTimeout(r, 150));
        return { ok: true, text: verdict };
      }
      fs.writeFileSync(path.join(o.cwd, 'index.html'), `<h1>${o.prompt.length}</h1>\n`);
      return { ok: true, text: 'done' };
    });
    listener = createListener({ runner, notify: () => {}, quietMs: 60_000, loadRegistry });
    listener.handlePayload(waPayload(NUMBER, 'slow1', 'first request'));
    const first = listener.flushNow(); // classifier for slow1 is now in flight
    await new Promise((r) => setTimeout(r, 30));
    const second = waPayload(NUMBER, 'slow2', 'second request marker');
    listener.handlePayload(second); // marks slow2 seen while the first batch still holds a stale snapshot
    await first; // first batch finishes and writes its history
    listener.handlePayload(second); // Meta redelivers slow2
    await listener.flushNow();
    const haiku = runner.calls.filter((c) => c.model === 'haiku');
    const mentions = haiku.reduce((n, c) => n + c.prompt.split('second request marker').length - 1, 0);
    expect(mentions).toBe(1);
    expect(haiku).toHaveLength(2);
    expect(runner.calls.filter((c) => c.model !== 'haiku')).toHaveLength(2);
  });

  it('a failing classifier is logged as an error and notified, not silently ignored', async () => {
    withHome();
    const { dir } = makeRepo();
    connectProject(dir, `+${NUMBER}`);
    const notes: string[] = [];
    const runner = new FakeRunner(() => ({ ok: false, text: 'Failed to authenticate' }));
    listener = createListener({ runner, notify: (t, b) => { notes.push(`${t}|${b}`); }, quietMs: 60_000, loadRegistry });
    listener.handlePayload(waPayload(NUMBER, 'cf1', 'change the heading'));
    await listener.flushNow();
    const log = fs.readFileSync(logFile(dir), 'utf8');
    expect(log).toContain('**error**');
    expect(log).toContain('classifier failed: Failed to authenticate');
    expect(log).not.toContain('ignored-unclear');
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/Client-auto classifier failed/);
    expect(runner.calls.filter((c) => c.model !== 'haiku')).toHaveLength(0);
  });

  it('a throwing notify never breaks the classifier-failure path', async () => {
    withHome();
    const { dir } = makeRepo();
    connectProject(dir, `+${NUMBER}`);
    const runner = new FakeRunner(() => ({ ok: false, text: 'boom' }));
    listener = createListener({ runner, notify: () => { throw new Error('down'); }, quietMs: 60_000, loadRegistry });
    listener.handlePayload(waPayload(NUMBER, 'cf2', 'change the heading'));
    await listener.flushNow();
    expect(fs.readFileSync(logFile(dir), 'utf8')).toContain('classifier failed: boom');
  });

  it('a normal unclear verdict still logs ignored-unclear and does not notify', async () => {
    withHome();
    const { dir } = makeRepo();
    connectProject(dir, `+${NUMBER}`);
    const notes: string[] = [];
    const runner = new FakeRunner(() => ({ ok: true, text: '{"label":"unclear","task":""}' }));
    listener = createListener({ runner, notify: (t, b) => { notes.push(`${t}|${b}`); }, quietMs: 60_000, loadRegistry });
    listener.handlePayload(waPayload(NUMBER, 'cu1', 'make it nicer'));
    await listener.flushNow();
    const log = fs.readFileSync(logFile(dir), 'utf8');
    expect(log).toContain('**ignored-unclear**');
    expect(log).not.toContain('**error**');
    expect(notes).toHaveLength(0);
  });

  it('a corrupt projects.json does not throw out of handlePayload and is reported on stderr', async () => {
    const { runner } = setup();
    fs.writeFileSync(path.join(process.env.CLIENT_AUTO_HOME!, 'projects.json'), '{ broken');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => listener.handlePayload(waPayload(NUMBER, 'k1', 'change the heading'))).not.toThrow();
      await listener.flushNow();
      expect(spy).toHaveBeenCalledWith(expect.stringMatching(/projects\.json is corrupt/));
    } finally { spy.mockRestore(); }
    expect(runner.calls).toHaveLength(0);
  });
});

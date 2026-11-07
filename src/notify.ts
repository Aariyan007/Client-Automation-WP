import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (process.platform === 'darwin') {
      await exec('osascript', [
        '-e', 'on run argv',
        '-e', 'display notification (item 1 of argv) with title (item 2 of argv)',
        '-e', 'end run',
        body.slice(0, 200), title,
      ]);
    } else if (process.platform === 'linux') {
      await exec('notify-send', [title, body.slice(0, 200)]);
    }
  } catch { /* notifications are best-effort */ }
}

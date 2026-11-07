import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

// '--' ends option parsing so client text starting with '-' is never read as a flag.
export function notifyCommand(
  title: string,
  body: string,
  platform: NodeJS.Platform,
): { cmd: string; args: string[] } | null {
  const text = body.slice(0, 200);
  if (platform === 'darwin') {
    return {
      cmd: 'osascript',
      args: [
        '-e', 'on run argv',
        '-e', 'display notification (item 1 of argv) with title (item 2 of argv)',
        '-e', 'end run',
        '--', text, title,
      ],
    };
  }
  if (platform === 'linux') {
    return { cmd: 'notify-send', args: ['--', title, text] };
  }
  return null;
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    const c = notifyCommand(title, body, process.platform);
    if (c) await exec(c.cmd, c.args);
  } catch { /* notifications are best-effort */ }
}

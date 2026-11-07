# client-auto

Bind a project to a client's WhatsApp number. When the client texts a website change, Claude makes it and pushes to GitHub. Chit-chat is ignored. You deploy yourself.

## How it works
1. In a project chat, run the `connect-client` skill and give the client's number.
2. A small local service receives WhatsApp Business Cloud API webhooks (through a Cloudflare Tunnel).
3. It only reads messages from the number you connected. Every other sender is dropped before anything is saved.
4. A cheap Claude call decides: website change, chat, or unclear. Only real change requests run.
5. Claude edits the project, your build/lint/tests run, then one commit tagged `client-auto:` is pushed.

## Privacy and safety
- Official WhatsApp Business Cloud API only; no unofficial libraries or scraping.
- The plugin only reads messages from the number you connect, and never replies to the client.
- The plugin has no telemetry and keeps all its own data on your machine. Client messages still pass through Meta and your Cloudflare Tunnel to reach you, and the text of a change request is sent to Anthropic by the `claude` CLI when Claude works on it.
- Client text is treated as data, not commands. Requests for secrets, deletions, billing or domain changes are refused and logged.
- Changes never run on top of your uncommitted work. If you have local edits, the job is skipped.
- `/client-undo` reverts the last change. Nothing is ever force-pushed.
- Pause, disconnect or fully wipe any time with `disconnect-client`.

## Install
**client-auto is not published to npm yet.** Install it from source:
```bash
git clone https://github.com/Aariyan007/Client-Automation-WP.git
cd Client-Automation-WP
npm install
npm run build
npm link
```
Then in Claude Code add this repository as a plugin marketplace and install `client-auto`. Follow [docs/setup.md](docs/setup.md) for the Meta app and Cloudflare Tunnel.

## Known limits
- **Request guard is a first filter only.** It is a simple check. Legitimate requests that mention things like a billing address field or the site's domain name may be refused. When that happens you are notified so you can do the change by hand.
- **Do not edit the project folder while a client job is running.** The tool may discard or publish those edits. Jobs are skipped when you have uncommitted changes at the start.
- **Keep build output out of git.** Put `dist/`, `.next/` and similar folders in the project's `.gitignore`. Otherwise a successful build may be committed.
- **The editing agent is not a sandbox.** It runs with a restricted tool list, but that is not an operating-system sandbox. Run it on a machine or account you trust.
- **Text messages only in v1.** Images, voice notes and documents are ignored.
- macOS and Linux. One WhatsApp business number per listener.
- Your computer must be on and `client-auto start` running. Messages sent while it is off may be lost (see [docs/setup.md](docs/setup.md)).

MIT licence.

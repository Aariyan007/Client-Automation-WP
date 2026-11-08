# Client-Auto: WhatsApp-to-Claude plugin (design spec)

Date: 2026-11-07
Status: draft, awaiting owner review

## 1. Problem and goal

A freelancer builds client websites with Claude Code. Each time a client asks for a
change, the freelancer must open Claude and type the request by hand.

Goal: a Claude Code plugin that binds one project folder to one client's WhatsApp number.
When that client messages a change request, Claude makes the change and pushes it to GitHub.
Messages that are not website requests are ignored. The plugin is released publicly.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| WhatsApp connection | Official WhatsApp Business Cloud API (official API only, no unofficial libraries) |
| Receiving messages | Meta webhook, exposed to the user's machine with Cloudflare Tunnel |
| Replies to the client | None. The plugin is silent toward the client |
| Output of a job | Commit and push to GitHub. The user deploys themselves |
| Target branch | Repo default branch, configurable per project to a separate branch |
| Architecture | Background listener plus headless Claude runs (not a live chat session) |
| Scope of reading | Only the bound client's number. Everything else is dropped unstored |
| Disconnect | Three levels: pause, disconnect, full wipe |
| Job types | Edit an existing site, or build a new site from the client's description |

## 3. Components

### 3.1 Skills (installed with the plugin)
- `/connect-client`: run in a project chat. Asks "Connect this project to a client's WhatsApp?",
  collects Cloud API credentials once, asks for the client's number, writes the binding to
  `.client-auto/config.json` in the project folder, registers it with the listener.
- `/client-status`: shows listener state, bound number, last jobs.
- `/client-undo`: reverts the last `client-auto:` commit (new revert commit, never force-push).
- `/disconnect-client`, `/resume-client`: see section 6.

### 3.2 Listener (one local Node service, many projects)
- HTTP endpoint for the Meta webhook, reached through Cloudflare Tunnel.
- Verifies Meta's challenge on setup and the `X-Hub-Signature-256` signature on every
  request. Unsigned or wrongly signed requests are rejected.
- Keeps a registry: client number -> project folder (`~/.client-auto/projects.json`).
- Drops any message whose sender is not a bound number, before logging or storing it.
  Only text messages are handled in v1; other types are logged as "unsupported" and skipped.
- Stores processed message IDs so a webhook retry never runs a job twice.

### 3.3 Classifier
- A small, cheap model reads the new message plus the client's last few messages for context.
- Output: `change_request`, `chat` or `unclear`, plus a one-line task summary.
- `chat` and `unclear` are logged and ignored. No action, no reply.

### 3.4 Worker
- Waits about 30 seconds of quiet so several quick messages become one task.
- Runs Claude headless in the project folder with a prompt built from the task summary
  and the raw client messages (treated as data, see 4.2).
- One job at a time per project (queue). On success: one commit, tagged `client-auto:`, pushed.

### 3.5 Log
- `.client-auto/log.md` per project: message text, classifier decision, outcome, commit sha.

## 4. Safety

### 4.1 Permissions
The worker may edit files inside the project folder and run git. It may not read `.env` or
other secrets, run deploy commands, or touch anything outside the folder. Enforced with the
Claude CLI tool allow/deny flags passed on the headless run (not a generated settings file).
This is a restricted tool list, not an operating-system sandbox. Installs run with `--ignore-scripts`.

After the agent finishes and before checks run, the worker compares the changes with HEAD. If the
agent touched `.github/`, `.husky/`, any `.npmrc`, or changed the `scripts` field of `package.json`,
the changes are discarded, nothing is pushed, the refusal is logged as a protected path change and
the user is notified.

### 4.2 Client text is data
Messages are never executed as instructions beyond "make this website change". Requests such as
"send me the env file", "delete the repo", "change billing or the domain" are refused and logged.

### 4.3 Checks before pushing
If the project defines build, lint or tests, they run first. On failure: nothing is pushed,
the failure is logged and the user is notified.

### 4.4 Undo, limits, notifications
- Each job is one commit. `/client-undo` reverts it. No force-pushes.
- Maximum jobs per hour per project (default set in config).
- Local notification to the user after every push, failure or refusal.

## 5. Data and privacy
- All data stays on the user's machine. No telemetry.
- Messages from non-bound numbers are dropped without being written anywhere.
- Webhook verify token and app secret are stored locally with restrictive file permissions. No access token is stored because v1 never sends messages.

## 6. Disconnect (`/disconnect-client`)
1. **Pause:** stop acting on messages, keep the binding. `/resume-client` re-enables.
2. **Disconnect:** remove the number from the project and stop accepting its messages.
   The user chooses to keep or delete that project's log.
3. **Full wipe:** also delete the project's `.client-auto` folder, and delete saved credentials if no other project remains bound.

## 7. Requirements for users
- Node 20+, Claude Code signed in, push access to the project's git remote.
- A Meta developer app and a dedicated phone number registered on the WhatsApp Cloud API (coexistence with the Business app is not assumed).
- A Cloudflare account with a domain, so the tunnel has a stable hostname.
- The computer must be on and the listener running. Meta retries failed webhooks for a limited
  time, so long downtime can lose messages.

## 8. Testing
- Fixture set of sample client messages (change request vs chat vs unclear) to evaluate the classifier.
- A fake webhook sender so tests run without Meta.
- Dry-run mode: classify and log, but do not edit or push.

## 9. v1 scope
In: macOS and Linux, one WhatsApp business number per listener, text messages, edit or build
from description, push to GitHub, MIT licence, README with setup guide and privacy notes.

Out of v1: replies to the client, images and voice notes (screenshots are the first v2 item),
Windows, hosted relay, unofficial (Baileys) adapter.

## 10. Open items to verify before building
1. Meta coexistence (WhatsApp Business app and Cloud API on one number): availability and
   requirements. Sources found were vendor blogs, not Meta docs.
2. Current Cloud API pricing for receive-only use, and test-number limits (recipient cap, token expiry).
3. Whether a stable Cloudflare Tunnel URL needs a user-owned domain, and the simplest setup path.
4. Read the existing `claude-channel-whatsapp` project on GitHub for overlap and lessons.
5. Meta webhook retry window, to document the downtime risk accurately.

Results: see docs/verification-notes.md

# Verification notes

Checked 2026-11-07. Web pages were summarised through a fetch tool, not read verbatim. Treat page-derived facts as "as summarised" and re-read the source before relying on exact numbers.

## Plan corrections

No flag-name corrections are needed. All flags the plan assumes exist in `claude` 2.1.287.

One correction to the plan's wording and one open item:

- `--permission-mode` choices in this version are: `acceptEdits`, `auto`, `bypassPermissions`, `manual`, `dontAsk`, `plan`. Tasks 7 and 9 must use one of these exact values. `default` is not in the list (use `manual` for prompting behaviour).
- The success-case JSON shape could NOT be observed (see "Claude CLI" below: OAuth session expired, so every call returned an error result). `parseCliOutput` must handle `is_error: true` with `result` holding the error text, and must not assume `subtype` reflects success: the error result observed had `"subtype":"success"` together with `"is_error":true`. Always branch on `is_error`.
- Re-run the success-case check once `claude` is signed in again, before Task 7 is finished.

## Claude CLI

Version: `claude --version` printed `2.1.287 (Claude Code)`.

Command: `claude --help | grep -E "print|output-format|model|allowedTools|disallowedTools|permission-mode"`

| Flag | Present | Notes |
|---|---|---|
| `-p, --print` | yes | "Print response and exit" |
| `--output-format <format>` | yes | only with `--print`; choices `text` (default), `json` (single result), `stream-json` |
| `--model <model>` | yes | alias (e.g. `haiku`) or full name |
| `--allowedTools, --allowed-tools <tools...>` | yes | variadic |
| `--disallowedTools, --disallowed-tools <tools...>` | yes | variadic |
| `--permission-mode <mode>` | yes | choices: `acceptEdits`, `auto`, `bypassPermissions`, `manual`, `dontAsk`, `plan` |

Command: `claude -p "reply with the single word ok" --output-format json --model haiku` (run twice, same outcome, exit code 1).

Observed output (trimmed): a single JSON object with keys including
`type: "result"`, `subtype: "success"`, `is_error: true`, `result: "Failed to authenticate: OAuth session expired and could not be refreshed"`, `terminal_reason: "api_error"`, `api_error_status: null`, `session_id`, `total_cost_usd`, `usage`, `duration_ms`, `num_turns`, `permission_denials`.

Findings:
- Confirmed: `result` is a string; `is_error` is a boolean; output is one JSON object on stdout; process exit code is non-zero (1) when `is_error` is true.
- UNVERIFIED: the shape on a successful call (expected `is_error: false` and `result: "ok"`). Reason: the local Claude Code OAuth session had expired and could not be refreshed in this non-interactive run, so no model call completed. Re-sign in and re-run.
- Note: `subtype` is `"success"` even on an auth failure. Do not use it to detect errors; use `is_error` (and the exit code).

## Spec section 10 items

### 1. Meta coexistence (WhatsApp Business app and Cloud API on one number)

- Answer: Coexistence lets a business keep using the WhatsApp Business app on a number while that same number is onboarded to Cloud API, with message history synced between them. Requirements as summarised: WhatsApp Business app version 2.24.17 or later; onboarding must be done as a Solution Partner or Tech Provider via Embedded Signup (with session logging); webhook endpoint must reliably accept payloads. Throughput on such numbers is capped at 20 messages per second. Groups, broadcast lists and calls are not supported on Cloud API. Extra webhook fields exist (`smb_message_echoes`, `history`, `smb_app_state_sync`, `account_update`). The page lists no country restrictions but also gives no availability list; Embedded Signup v2/v3 are deprecated from 2026-10-15 (v4+ needed).
- Implication for client-auto: the Tech Provider / Solution Partner requirement means an individual developer using their own Meta app is probably NOT able to use coexistence directly. v1 should assume a dedicated number on the Cloud API (not shared with the Business app). Treat coexistence for self-serve users as UNVERIFIED until confirmed against a page that describes the non-partner path.
- Source: https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users
- Date checked: 2026-11-07
- Status: availability list and non-partner eligibility UNVERIFIED.

### 2. Receive-only pricing and test-number limits

- Pricing answer: Messages from users to businesses are free. Charges apply to outbound business messages (by category and market), per delivered message, since 2025-07-01. Service messages get 1,000 free per month per business phone number; charging for service messages beyond that resumes 2026-10-01. Because v1 never sends messages, receive-only use is free.
- Source: https://developers.facebook.com/docs/whatsapp/pricing
- Date checked: 2026-11-07
- Test-number limits: UNVERIFIED. The pages checked say the temporary access token "expires quickly" and recommend a system user token, and that test numbers have "relaxed messaging limits" with no numeric caps. The recipient-number cap for the test number and the exact token lifetime were not stated on the pages fetched (https://developers.facebook.com/docs/whatsapp/cloud-api/get-started and https://developers.facebook.com/docs/whatsapp/cloud-api/overview). Note: test numbers exist to send to up to a few allow-listed recipients; for an inbound-only flow the client must message the test number, and whether that works without allow-listing is UNVERIFIED.
- Date checked: 2026-11-07

### 3. Does a stable Cloudflare Tunnel hostname need a user-owned domain?

- Answer: Yes for a stable public hostname. Quick Tunnels (`trycloudflare.com`) need no account or domain but the hostname changes every time and the URL dies when `cloudflared` stops; Cloudflare says they are for testing and development, with no uptime guarantee. A named tunnel with a published application route requires a website (domain) added to the user's Cloudflare account. Meta needs a fixed callback URL, so v1 setup docs should require a domain on Cloudflare (or let the user use another stable HTTPS endpoint). A Quick Tunnel can only be used for short demos because the callback URL would need re-registering with Meta each run.
- Sources: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/ and https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/
- Date checked: 2026-11-07
- Status: confirmed as summarised by the fetch tool; the quoted prerequisite should be re-read on the live page. Whether a free `*.cfargotunnel.com` address can serve as a public webhook URL: UNVERIFIED.

### 4. claude-channel-whatsapp (github.com/riasistemas/claude-channel-whatsapp)

- Answer: Maintained by RIA Systems, Apache-2.0. The current `main` is a stateless Claude skill plugin that drafts replies to pasted WhatsApp conversations; it does not read or send messages itself and makes no network calls. Up to v0.1.10 it ran a local MCP server receiving Meta Cloud API webhooks through the user's own Meta app; that channel moved to a separate `whatsapp-local` plugin on the `local` branch. A "connected version" is planned, not released. Overlap with client-auto: only the Cloud-API-webhook-to-local-Claude idea (in the older/`local` code). No overlap in the "turn change requests into git commits" goal. Lessons: keep the heavy Meta-app setup separate from the simple install path; keep credential file paths stable across releases; state non-affiliation with Meta and Anthropic.
- Source: https://github.com/riasistemas/claude-channel-whatsapp
- Date checked: 2026-11-07
- Status: the `local` branch code was not read; findings come from the main README only. Reading `whatsapp-local` for webhook/signature-handling lessons is UNVERIFIED/not done.

### 5. Meta webhook retry window

- Answer: Meta retries failed webhook deliveries (any response other than HTTP 200) with decreasing frequency for up to 7 days. Intervals are not published on the page. Duplicate deliveries are possible, so the listener must be idempotent (dedupe on message id).
- Source: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks
- Date checked: 2026-11-07
- Status: confirmed as summarised; re-read the live page to confirm the "7 days" figure before quoting it in the README.

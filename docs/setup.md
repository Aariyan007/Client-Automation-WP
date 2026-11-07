# Setup

## Before you start
- **Use a dedicated phone number that is registered on the WhatsApp Cloud API.** Do not use a number that is on the regular WhatsApp or WhatsApp Business app. Running the Business app and the Cloud API on one number (coexistence) is not assumed to be available to solo developers.
- **Cloudflare with a domain.** A stable Cloudflare Tunnel hostname needs a domain on your Cloudflare account. Quick tunnels give random URLs that change on every run and break the Meta webhook.
- **A git identity in each project.** Set `git config user.name` and `git config user.email` (locally or globally) in every project you connect, and make sure `git push` works there. Commits and pushes fail without them.
- **The computer must stay on.** `client-auto start` must be running for messages to be processed.

## 1. Meta (WhatsApp Business Cloud API)
1. Create a Meta developer app with the WhatsApp product (developers.facebook.com).
2. Add your dedicated phone number on the Cloud API. Meta's test number also works while building, but it only delivers to recipients you approve, and its temporary token expires quickly (about 24 hours at last report; check Meta's current docs).
3. Copy the **App secret** (App settings > Basic).

Version 1 only receives messages. It needs no WhatsApp access token: only the app secret (step 2) and the verify token it prints.

## 2. Save credentials
```bash
client-auto setup
```
Paste the app secret when asked. It prints a **Verify token**; keep it for step 4.

`client-auto setup` refuses to overwrite existing credentials. Use `client-auto setup --force` only when you need to replace them. `--force` rotates the verify token, so you must then update the Verify token in Meta (step 4) or the webhook will fail.

## 3. Cloudflare Tunnel
```bash
brew install cloudflared                      # or your package manager
cloudflared tunnel login
cloudflared tunnel create client-auto
cloudflared tunnel route dns client-auto hooks.yourdomain.com
```
`~/.cloudflared/config.yml`:
```yaml
tunnel: client-auto
credentials-file: /path/to/<tunnel-id>.json
ingress:
  - hostname: hooks.yourdomain.com
    service: http://127.0.0.1:8787
  - service: http_status:404
```
```bash
cloudflared tunnel run client-auto
```
If you ran `client-auto setup --port N`, change the `service: http://127.0.0.1:8787` line to that port.

## 4. Point Meta at it
In the app: WhatsApp > Configuration > Webhook. Callback URL `https://hooks.yourdomain.com/webhook`, Verify token from step 2. Subscribe to the **messages** field.

## 5. Run
```bash
client-auto start
```
Keep it running. In a project chat, run the `connect-client` skill.

## Missed messages
Meta retries webhooks that do not get an HTTP 200 response, but only for a limited time (reported as up to 7 days; check Meta's webhook documentation for the current figure). If the computer is off or the tunnel is down for longer than that, messages can be lost. Keep the machine awake and the tunnel running.

Messages are also held in memory for a short time before they are processed (a 30 second batching window, plus any wait behind a running job). If `client-auto start` stops in that time, those messages are lost: Meta already got a 200 response and will not retry them. Ask the client to resend after a restart.

## Try it safely
`client-auto connect <folder> <number> --dry-run` classifies and logs messages without editing or pushing.

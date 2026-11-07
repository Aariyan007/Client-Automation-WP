# Setup

## Before you start
- **Use a dedicated phone number that is registered on the WhatsApp Cloud API.** Do not use a number that is on the regular WhatsApp or WhatsApp Business app. Running the Business app and the Cloud API on one number (coexistence) is not assumed to be available to solo developers.
- **Cloudflare with a domain.** A stable Cloudflare Tunnel hostname needs a domain on your Cloudflare account. Quick tunnels give random URLs that change on every run and break the Meta webhook.
- **The computer must stay on.** `client-auto start` must be running for messages to be processed.

## 1. Meta (WhatsApp Business Cloud API)
1. Create a Meta developer app with the WhatsApp product (developers.facebook.com).
2. Add your dedicated phone number on the Cloud API. Meta's test number also works while building, but it only delivers to recipients you approve, and its temporary token expires after 24 hours. Use a permanent or system-user token for real use.
3. Copy the **App secret** (App settings > Basic).

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

## 4. Point Meta at it
In the app: WhatsApp > Configuration > Webhook. Callback URL `https://hooks.yourdomain.com/webhook`, Verify token from step 2. Subscribe to the **messages** field.

## 5. Run
```bash
client-auto start
```
Keep it running. In a project chat, run the `connect-client` skill.

## Missed messages
Meta retries webhooks that do not get an HTTP 200 response, but only for a limited time (reported as up to 7 days; check Meta's webhook documentation for the current figure). If the computer is off or the tunnel is down for longer than that, messages can be lost. Keep the machine awake and the tunnel running.

## Try it safely
`client-auto connect <folder> <number> --dry-run` classifies and logs messages without editing or pushing.

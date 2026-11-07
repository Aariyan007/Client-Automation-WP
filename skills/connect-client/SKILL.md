---
name: connect-client
description: Connect the current project folder to a client's WhatsApp number so their website change requests are fixed and pushed automatically. Use when the user wants to link a client's WhatsApp to this project.
---

# Connect this project to a client's WhatsApp

1. Ask the user: "Connect this project to a client's WhatsApp number?" Stop if they say no.
2. Ask for the client's number with country code (for example +91 98765 43210). Ask whether changes should go to a separate branch (default: the current branch).
3. Run `client-auto status "$PWD"` first. If the folder is already connected, tell the user to run the disconnect-client skill first, then stop. If the CLI is missing, tell the user to install the client-auto CLI as described in the README, then stop. Otherwise proceed.
4. Run `client-auto connect "$PWD" "<number>"` (add `--branch <name>` if requested; add `--dry-run` if the user wants to test without edits or pushes). If `client-auto start` later says to run setup first, follow docs/setup.md.
5. Tell the user: from now on, only that number's messages are read; chit-chat is ignored; the plugin never replies to the client; the background service must be running (`client-auto start`) and the Cloudflare Tunnel must be up.
6. Never read, list or summarise any other WhatsApp chats or the `.client-auto/` folder contents beyond what `client-auto status` prints.

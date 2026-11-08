---
name: disconnect-client
description: Pause, disconnect or fully wipe the client WhatsApp link for this project. Use when the user wants to stop reading a client's messages.
---

Ask which level the user wants, then run the matching command:

1. **Pause** (keeps the link, ignores messages until resumed): `client-auto pause "$PWD"`
2. **Disconnect** (removes the number from this project; keeps the log): `client-auto disconnect "$PWD"`. Add `--delete-log` if the user wants the log deleted too.
3. **Full wipe** (deletes the project's `.client-auto` folder, and saved credentials if no other project remains): `client-auto disconnect "$PWD" --wipe`. Confirm explicitly before running; this cannot be undone.

Report exactly what was removed.

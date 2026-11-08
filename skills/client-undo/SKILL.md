---
name: client-undo
description: Undo the most recent change the plugin made from a client's WhatsApp request. Use when the user wants to revert the last client-auto commit.
---

# Undo the last change from this plugin

1. Run `client-auto undo "$PWD"`. This creates a local revert commit for the most recent change the plugin made. It does not push. It refuses to run if the project has uncommitted changes; if so, tell the user to commit or stash them first, then stop.
2. Show the user the result. Ask whether they want to push the revert. Only if they say yes, run `git push origin HEAD`. If they say no, stop; the revert stays local.
3. Running this skill again reverts the next older change the plugin made. Tell the user this if they want to undo more than one change.

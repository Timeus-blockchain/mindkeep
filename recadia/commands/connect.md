---
description: Connect this computer to your Recadia account so Claude Code sessions are saved there
argument-hint: "[server address, default https://recadia.timeuslab.com]"
allowed-tools: Bash(node:*)
---

Connect the autosave of this computer to Recadia.

Run this command with the Bash tool and a timeout of 330000 ms (it waits up to 5 minutes for the person to allow it in the browser):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/connect.mjs" $ARGUMENTS
```

It opens the browser on the Recadia page "Connect a computer". Tell the person to sign in if asked and press "Allow". If the browser did not open, give the person the link the command printed.

When the command finishes, tell the person in one line whether it is connected. Do not print, read or copy the file `~/.recadia/autosave.json`: it holds the key.

# Mindkeep for Claude Code

Mindkeep is your shared memory and task list for AI agents. This plugin does three things in Claude Code:

- **Connects Mindkeep.** It adds the Mindkeep server (`https://mindkeep.timeuslab.com/mcp`), so Claude can
  read your memory and tasks and propose new records. Nothing is written without your approval in Mindkeep.
- **Reminds Claude at the start of every chat** to sign in to Mindkeep, read your rules and propose
  decisions and preferences as they come up. The reminder is a short text; it reads no files and makes no
  network calls.
- **Saves your sessions** to your Mindkeep account (after you run `/mindkeep:connect` once).

## Install

In a terminal:

```
claude plugin install mindkeep --marketplace Timeus-blockchain/mindkeep
```

Or inside Claude Code:

```
/plugin install mindkeep --marketplace Timeus-blockchain/mindkeep
```

It needs Claude Code 2.1.292 or later; with an older version, add the catalog first and then install:

```
claude plugin marketplace add Timeus-blockchain/mindkeep
claude plugin install mindkeep@mindkeep
```

The install may print `1 userConfig option not yet set`. That option is the Mindkeep address; left unset,
the plugin uses the Mindkeep cloud.

## First use

1. Start Claude Code, run `/mcp`, choose `plugin:mindkeep:mindkeep` and sign in to Mindkeep in the browser.
2. To save your sessions too, run `/mindkeep:connect`. The browser opens Mindkeep. Sign in and press "Allow".
   From then on, each session is sent to your account when Claude answers, before the context is compacted
   and when the session ends. Only new lines are sent, nothing is saved twice. Without a connection,
   sending waits and the rest goes the next time.

In a new chat Claude then signs in to Mindkeep by itself. Its Mindkeep tools are named
`mcp__plugin_mindkeep_mindkeep__<tool>`, for example `mcp__plugin_mindkeep_mindkeep__register_agent`.

## Your own Mindkeep server

If you run Mindkeep on your own server, set its address (without `/mcp` at the end):

```
claude plugin install mindkeep --marketplace Timeus-blockchain/mindkeep --config server=https://mindkeep.example.com
```

For an installed plugin, run `/plugin configure mindkeep@mindkeep` in Claude Code, or change "Mindkeep
address" in `/config`, then restart Claude Code. For saving sessions, run
`/mindkeep:connect https://mindkeep.example.com`.

## If you already added Mindkeep by hand

If you added the same address before, for example with
`claude mcp add --transport http mindkeep https://mindkeep.timeuslab.com/mcp`, Claude Code connects to it
once: your own entry is used and the plugin's copy is skipped, so there is no second connection and you
keep your sign-in. The reminder works with either. You may remove your own entry
(`claude mcp remove <name> --scope user`) and sign in again through the plugin, or keep it.
An entry with a different address (another server, or the same one spelled with another path) counts as
a separate server.

## Remove

```
claude plugin uninstall mindkeep@mindkeep
```

This removes the Mindkeep connection that came with the plugin, the start-of-chat reminder, the session
saving hooks and the plugin's saved options. To also forget the catalog, run
`claude plugin marketplace remove mindkeep`. A Mindkeep server you added by hand stays.

The key for saving sessions is kept in `~/.mindkeep/autosave.json`, not in the settings of Claude Code,
and uninstalling does not delete it. To stop saving on this computer, delete that file, or disconnect the
computer in your Mindkeep account.

Plugins do not load in Claude Code sessions that run in the cloud.

## License

Proprietary, all rights reserved: you may install and use the plugin with Mindkeep. See `LICENSE`.

Made by Timeus Lab S.L.

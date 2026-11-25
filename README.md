# Recadia for Claude Code

Recadia is your shared memory and task list for AI agents. This plugin does three things in Claude Code:

- **Connects Recadia.** It adds the Recadia server (`https://recadia.timeuslab.com/mcp`), so Claude can
  read your memory and tasks and propose new records. Memory, notes and new tasks wait for your approval in
  Recadia (unless you allow it to save some of them at once). Tasks you gave to Claude it updates directly.
- **Reminds Claude at the start of every chat** to sign in to Recadia, read your rules and propose
  decisions and preferences as they come up. The reminder is a short text; it reads no files and makes no
  network calls.
- **Saves your sessions** to your Recadia account (after you run `/recadia:connect` once).

## Install

In a terminal:

```
claude plugin install recadia --marketplace Timeus-blockchain/recadia
```

Or inside Claude Code:

```
/plugin install recadia --marketplace Timeus-blockchain/recadia
```

It needs Claude Code 2.1.292 or later; with an older version, add the catalog first and then install:

```
claude plugin marketplace add Timeus-blockchain/recadia
claude plugin install recadia@recadia
```

The install may print `1 userConfig option not yet set`. That option is the Recadia address; left unset,
the plugin uses the Recadia cloud.

## First use

1. Start Claude Code, run `/mcp`, choose `plugin:recadia:recadia` and sign in to Recadia in the browser.
2. To save your sessions too, run `/recadia:connect`. The browser opens Recadia. Sign in and press "Allow".
   From then on, each session is sent to your account when Claude answers, before the context is compacted
   and when the session ends. Only new lines are sent, nothing is saved twice. Without a connection,
   sending waits and the rest goes the next time.

In a new chat Claude then signs in to Recadia by itself. Its Recadia tools are named
`mcp__plugin_recadia_recadia__<tool>`, for example `mcp__plugin_recadia_recadia__register_agent`.

## Your own Recadia server

If you run Recadia on your own server, set its address (without `/mcp` at the end):

```
claude plugin install recadia --marketplace Timeus-blockchain/recadia --config server=https://recadia.example.com
```

For an installed plugin, run `/plugin configure recadia@recadia` in Claude Code, or change "Recadia
address" in `/config`, then restart Claude Code. For saving sessions, run
`/recadia:connect https://recadia.example.com`.

## What runs and what is sent

| When | What runs | What it does |
|---|---|---|
| A chat starts, resumes or is compacted | `scripts/session-start.mjs` | Prints a short reminder for Claude. No files, no network |
| Claude answers, before compaction, the session ends | `scripts/autosave.mjs` | Does nothing until you run `/recadia:connect`, except write a line to `~/.mindkeep/autosave.log` if that folder exists. After that it sends the new lines of this session's transcript, and of its subagents, to your Recadia server |
| You run `/recadia:connect` | `scripts/connect.mjs` | Opens the browser, listens on 127.0.0.1 for the answer (up to 5 minutes), sends your computer's name with the request, and stores the key |
| Claude uses a Recadia tool | the `recadia` MCP server | Reads and proposes records in your account, after you sign in |

- **Session content is personal data.** A transcript holds your messages, Claude's answers and tool calls with
  their results, which can include the text of files. Connect only if you want it kept in Recadia. The level
  you choose in Recadia decides how much of it is stored.
- Data goes only to the Recadia server you set: the Recadia cloud (Timeus Lab S.L.) by default, or your own.
  The plugin has no analytics and contacts no other service.
- Data is kept while your account exists; on request the account and its data are deleted. Details and contact:
  the [privacy policy](https://recadia.timeuslab.com/privacy/).
- Files it keeps on this computer, in `~/.mindkeep`: the key (`autosave.json`), how far each session was sent
  (`autosave-state.json`), a log (`autosave.log`) and, after a disconnect, `disconnected.json`.
- The scripts are bundled, not minified. They need Node.js 20 or later.

## If you already added Recadia by hand

If you added the same address before, for example with
`claude mcp add --transport http recadia https://recadia.timeuslab.com/mcp`, Claude Code connects to it
once: your own entry is used and the plugin's copy is skipped, so there is no second connection and you
keep your sign-in. The reminder works with either. You may remove your own entry
(`claude mcp remove <name> --scope user`) and sign in again through the plugin, or keep it.
An entry with a different address (another server, or the same one spelled with another path) counts as
a separate server.

## Remove

```
claude plugin uninstall recadia@recadia
```

This removes the Recadia connection that came with the plugin, the start-of-chat reminder, the session
saving hooks and the plugin's saved options. To also forget the catalog, run
`claude plugin marketplace remove recadia`. A Recadia server you added by hand stays.

The key for saving sessions is kept in `~/.mindkeep/autosave.json`, not in the settings of Claude Code,
and uninstalling does not delete it. To stop saving on this computer, delete that file, or disconnect the
computer in your Recadia account.

Plugins do not load in Claude Code sessions that run in the cloud.

## License

Proprietary, all rights reserved: you may install and use the plugin with Recadia. See `LICENSE`.

Made by Timeus Lab S.L.

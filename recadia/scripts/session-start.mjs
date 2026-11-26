#!/usr/bin/env node

var REMINDER_MAX = 2e3;
var SOURCES = ["startup", "resume", "clear", "compact", "fork"];
var CORE = [
  "Recadia is the person's shared memory and task list for AI agents (MCP tools whose names end in __register_agent, __get_guide, __propose_memory; the server may have another name if the person added it by hand).",
  "- Before the first task of this chat, call register_agent, then get_guide, and follow the rules it returns. If register_agent shows waiting work, tell the person.",
  "- When the person states a decision, an agreement or a preference, propose it at once with propose_memory (several at once: propose_memories). Do not ask in chat first.",
  '- If no Recadia tools are available, or they say you are not signed in, tell the person once, in one line: "Recadia is not connected: run /mcp, choose recadia and sign in." Then carry on with the task and do not repeat it.'
];
var LEAD = {
  startup: "Recadia reminder for this new chat.",
  clear: "Recadia reminder for this new chat.",
  fork: "Recadia reminder for this chat.",
  resume: "Recadia reminder for this resumed chat. If you already signed in to Recadia earlier in this chat, there is no need to do it again.",
  compact: "Recadia reminder after the context was compacted. If you no longer remember Recadia's rules, call get_guide again."
};
function reminderText(source) {
  return [LEAD[source], ...CORE].join("\n");
}
function sourceOf(input) {
  if (input && typeof input === "object" && "source" in input) {
    const s = input.source;
    if (typeof s === "string" && SOURCES.includes(s)) return s;
  }
  return "startup";
}
function sessionStartOutput(stdin) {
  try {
    let input = null;
    try {
      input = stdin.trim() ? JSON.parse(stdin) : null;
    } catch {
      input = null;
    }
    const text = reminderText(sourceOf(input));
    if (text.length > REMINDER_MAX) return "";
    return JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text }
    });
  } catch {
    return "";
  }
}

var STDIN_WAIT_MS = 300;
function outputFor(chunks) {
  try {
    return sessionStartOutput(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return "";
  }
}
function finish(chunks) {
  const out = outputFor(chunks);
  if (out) {
    try {
      process.stdout.write(out);
    } catch {
    }
  }
  process.exitCode = 0;
}
try {
  const chunks = [];
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    finish(chunks);
    process.stdin.destroy();
  };
  const timer = setTimeout(end, STDIN_WAIT_MS);
  process.stdin.on("data", (c) => chunks.push(c));
  process.stdin.on("end", end);
  process.stdin.on("error", end);
} catch {
  process.exitCode = 0;
}

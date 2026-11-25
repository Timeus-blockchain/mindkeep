#!/usr/bin/env node

// src/autosave-main.ts
import { appendFileSync, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname4, join as join4 } from "node:path";

// src/autosave.ts
import {
  closeSync,
  existsSync,
  lstatSync,
  openSync,
  readFileSync as readFileSync2,
  readSync,
  readdirSync,
  realpathSync
} from "node:fs";
import { gzipSync } from "node:zlib";
import { basename, dirname as dirname2, isAbsolute, join as join2, sep } from "node:path";

// src/disconnect.ts
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
function removeFile(path) {
  try {
    unlinkSync(path);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
function keyRefused(status, body) {
  if (status === 401) return true;
  if (status !== 403) return false;
  try {
    const o = JSON.parse(body);
    return o?.error?.code === "forbidden";
  } catch {
    return false;
  }
}
function disconnectedMarkerPath(configPath2) {
  return join(dirname(configPath2), "disconnected.json");
}
function forgetConnection(configPath2, reason, now = Date.now()) {
  try {
    removeFile(configPath2);
  } catch {
  }
  try {
    mkdirSync(dirname(configPath2), { recursive: true });
    writeFileSync(
      disconnectedMarkerPath(configPath2),
      `${JSON.stringify({ at: new Date(now).toISOString(), reason })}
`
    );
  } catch {
  }
}

// src/autosave.ts
var KEY_IN_TEXT = /roma_[A-Za-z0-9]+_[A-Za-z0-9_-]+/g;
var MAX_CHUNK = 512 * 1024;
var BUDGET_MS = 25e3;
var SERVICE_LINE = /^\{"type":"(?:api-request|api-request-shape|api-request-blob|data-flow-records|file-history-snapshot)"/;
var BINARY = /"(data|base64)":"([A-Za-z0-9+/=]{1000,})"/g;
function withoutBallast(data) {
  const text = data.toString("utf8").split("\n").filter((l) => l !== "" && !SERVICE_LINE.test(l)).map(
    (l) => l.replace(
      BINARY,
      (_m, k, v) => `"${k}":"","bytes":${Math.floor(v.length * 3 / 4)}`
    )
  ).join("\n");
  return Buffer.from(text ? `${text}
` : "", "utf8");
}
function safeSessionFile(path, claudeDir) {
  if (typeof path !== "string" || !isAbsolute(path) || !path.toLowerCase().endsWith(".jsonl")) {
    return null;
  }
  try {
    if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) return null;
    const root = realpathSync(join2(claudeDir, "projects"));
    const real = realpathSync(path);
    if (real !== path && real.toLowerCase() !== path.toLowerCase()) return null;
    return real.toLowerCase().startsWith((root + sep).toLowerCase()) ? real : null;
  } catch {
    return null;
  }
}
function workerFiles(session, claudeDir) {
  const dir2 = join2(dirname2(session), basename(session, ".jsonl"), "subagents");
  try {
    return readdirSync(dir2).filter((f) => f.toLowerCase().endsWith(".jsonl")).map((f) => safeSessionFile(join2(dir2, f), claudeDir)).filter((f) => f !== null);
  } catch {
    return [];
  }
}
function newLines(path, from) {
  const size = lstatSync(path).size;
  const start = from > size ? 0 : from;
  if (size <= start) return null;
  const fd = openSync(path, "r");
  try {
    for (let max = MAX_CHUNK; ; max *= 2) {
      const len = Math.min(size - start, max);
      const buf = Buffer.alloc(len);
      readSync(fd, buf, 0, len, start);
      const lastNl = buf.lastIndexOf(10);
      if (lastNl >= 0) return { data: buf.subarray(0, lastNl + 1), end: start + lastNl + 1 };
      if (len === size - start) return null;
    }
  } finally {
    closeSync(fd);
  }
}
async function runAutosave(input, config, deps) {
  const hook = input ?? {};
  const main2 = safeSessionFile(hook.transcript_path, deps.claudeDir);
  if (!main2) {
    const p = hook.transcript_path;
    const missing = typeof p === "string" && isAbsolute(p) && p.toLowerCase().endsWith(".jsonl") && !existsSync(p);
    deps.log(
      missing ? "skip: this session keeps no transcript (nothing to save)" : "skip: the session file is not a .jsonl inside the Claude Code projects folder"
    );
    return { sent: 0, failed: 0 };
  }
  const deadline = Date.now() + (deps.budgetMs ?? BUDGET_MS);
  let sent = 0;
  let failed = 0;
  let gz = true;
  files: for (const file of [main2, ...workerFiles(main2, deps.claudeDir)]) {
    for (; ; ) {
      const left = deadline - Date.now();
      if (left < 1e3) break files;
      const chunk = newLines(file, deps.readState()[file] ?? 0);
      if (!chunk) break;
      const body = withoutBallast(chunk.data);
      try {
        const res = body.length ? await deps.fetch(
          `${config.url.replace(/\/+$/, "")}/api/archive/session?name=${encodeURIComponent(basename(file))}${gz ? "&gz=1" : ""}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.key}`,
              "Content-Type": "application/octet-stream"
            },
            body: new Uint8Array(gz ? gzipSync(body) : body),
            signal: AbortSignal.timeout(Math.min(deps.timeoutMs ?? 2e4, left))
          }
        ) : null;
        if (res?.status === 400 && gz) {
          await res.body?.cancel().catch(() => void 0);
          gz = false;
          continue;
        }
        if (res && !res.ok) {
          failed++;
          const text = (await res.text().catch(() => "")).replace(KEY_IN_TEXT, "roma_\u2026");
          deps.log(`HTTP ${res.status} for ${basename(file)}: ${text.slice(0, 300)}`);
          if (keyRefused(res.status, text) && deps.onRejected) {
            deps.onRejected(res.status);
            break files;
          }
          break;
        }
        if (res) sent++;
        deps.writeState({ ...deps.readState(), [file]: chunk.end });
      } catch (err) {
        failed++;
        deps.log(`not sent ${basename(file)}: ${String(err).replace(KEY_IN_TEXT, "roma_\u2026")}`);
        break;
      }
    }
  }
  return { sent, failed };
}
function readConfig(path) {
  try {
    const o = JSON.parse(readFileSync2(path, "utf8"));
    return typeof o.url === "string" && typeof o.key === "string" ? { url: o.url, key: o.key } : null;
  } catch {
    return null;
  }
}

// src/connect.ts
import { homedir, hostname } from "node:os";
import { dirname as dirname3, join as join3 } from "node:path";
var CONNECT_TIMEOUT_MS = 5 * 60 * 1e3;
function defaultConfigPath(home = homedir()) {
  return join3(home, ".mindkeep", "autosave.json");
}

// src/autosave-main.ts
var configPath = process.argv[2] || defaultConfigPath();
var dir = dirname4(configPath);
var statePath = join4(dir, "autosave-state.json");
var logPath = join4(dir, "autosave.log");
var log = (line) => {
  try {
    appendFileSync(logPath, `${(/* @__PURE__ */ new Date()).toISOString()} ${line}
`);
  } catch {
  }
};
async function main() {
  const config = readConfig(configPath);
  if (!config) {
    log("skip: autosave.json is missing (the autosave is off in Recadia)");
    return;
  }
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    log("skip: the hook input is not JSON");
    return;
  }
  await runAutosave(input, config, {
    claudeDir: process.env.CLAUDE_CONFIG_DIR || join4(homedir2(), ".claude"),
    readState: () => {
      try {
        return JSON.parse(readFileSync3(statePath, "utf8"));
      } catch {
        return {};
      }
    },
    writeState: (s) => {
      try {
        writeFileSync2(statePath, JSON.stringify(s));
      } catch (err) {
        log(`state not saved: ${String(err)}`);
      }
    },
    log,
    fetch,
    // T2.23c: a refused key is dead for good (the computer was disconnected in the account): forget
    // it, so later hooks skip at once instead of sending the same files to a closed door.
    onRejected: (status) => {
      forgetConnection(configPath, `HTTP ${status}`);
      log(
        `stopped: the server refused the key (HTTP ${status}); this computer is disconnected. Connect it again to resume.`
      );
    }
  });
}
main().catch((err) => log(`error: ${String(err)}`));

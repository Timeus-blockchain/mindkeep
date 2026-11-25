#!/usr/bin/env node

// src/connect-main.ts
import { spawn } from "node:child_process";

// src/connect.ts
import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, hostname } from "node:os";
import { dirname, join } from "node:path";
var DEFAULT_SERVER = "https://recadia.timeuslab.com";
var CONNECT_TIMEOUT_MS = 5 * 60 * 1e3;
function defaultConfigPath(home = homedir()) {
  return join(home, ".mindkeep", "autosave.json");
}
var page = (title, text) => `<!doctype html><meta charset="utf-8"><title>Recadia</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1 style="font-size:1.4rem">${title}</h1><p>${text}</p></body>`;
function computerName(raw = hostname()) {
  return raw.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 60) || "computer";
}
function writeConfig(path, server2, key, backupKey) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ url: server2, key, backupKey }, null, 2)}
`, {
    mode: 384
  });
  try {
    chmodSync(path, 384);
  } catch {
  }
}
function back(res, url) {
  res.writeHead(302, {
    Location: url,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer"
  });
  res.end();
}
function connect(deps) {
  const server2 = deps.server.replace(/\/+$/, "");
  const state = deps.state ?? randomBytes(24).toString("base64url");
  let srv;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      srv?.close();
      reject(new Error("No answer from the browser in 5 minutes. Run the connection again."));
    }, deps.timeoutMs ?? CONNECT_TIMEOUT_MS);
    const finish = (err) => {
      clearTimeout(timer);
      setTimeout(() => srv?.close(), 50);
      if (err) reject(err);
      else resolve(server2);
    };
    srv = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const send = (status, html) => {
        res.writeHead(status, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer"
        });
        res.end(html);
      };
      if (req.method !== "GET" || url.pathname !== "/callback") return send(404, page("404", ""));
      if (url.searchParams.get("state") !== state) {
        return send(
          400,
          page(
            "It did not work",
            "This link is not from this connection. Run the connection again."
          )
        );
      }
      if (url.searchParams.has("error")) {
        if (deps.doneUrl) back(res, deps.doneUrl);
        else send(200, page("Declined", "The connection was declined. You can close this window."));
        return finish(new Error("The connection was denied in the browser."));
      }
      const code = url.searchParams.get("code") ?? "";
      deps.fetch(`${server2}/api/archive/autosave/exchange`, {
        method: "POST",
        headers: { Authorization: `Bearer ${code}` },
        signal: AbortSignal.timeout(2e4)
      }).then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok || typeof json.key !== "string") {
          throw new Error(
            `The server refused the code (HTTP ${r.status}). Run the connection again.`
          );
        }
        writeConfig(
          deps.configPath,
          server2,
          json.key,
          deps.backup && typeof json.backupKey === "string" ? json.backupKey : void 0
        );
        if (deps.doneUrl) back(res, deps.doneUrl);
        else
          send(
            200,
            page(
              "Done",
              "This computer saves Claude Code sessions to Recadia. You can close this window."
            )
          );
        finish(null);
      }).catch((err) => {
        send(502, page("It did not work", "Run the connection again."));
        finish(err instanceof Error ? err : new Error(String(err)));
      });
    });
    srv.on("error", (err) => finish(err));
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv?.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const q = new URLSearchParams({
        port: String(port),
        state,
        computer: deps.computer ?? computerName(),
        ...deps.backup ? { backup: "1" } : {}
      });
      const link = `${server2}/connect/autosave?${q.toString()}`;
      deps.say(`Opening the browser to connect this computer to Recadia:
${link}`);
      deps.openBrowser(link);
    });
  });
}

// src/connect-main.ts
function openBrowser(url) {
  try {
    const [cmd, args] = process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
  }
}
var server = process.argv[2] || process.env.MINDKEEP_URL || DEFAULT_SERVER;
if (!/^https?:\/\//.test(server)) {
  console.error("The server address must start with https:// (or http:// on this computer).");
  process.exit(1);
}
connect({
  server,
  configPath: defaultConfigPath(),
  openBrowser,
  say: (line) => console.log(line),
  fetch
}).then((url) => {
  console.log(`Connected: sessions of Claude Code on this computer now go to ${url}.`);
}).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

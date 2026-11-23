#!/usr/bin/env node

// src/connect-main.ts
import { spawn } from "node:child_process";

// src/connect.ts
import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, hostname } from "node:os";
import { dirname, join } from "node:path";
var DEFAULT_SERVER = "https://mindkeep.timeuslab.com";
var CONNECT_TIMEOUT_MS = 5 * 60 * 1e3;
function defaultConfigPath(home = homedir()) {
  return join(home, ".mindkeep", "autosave.json");
}
var page = (title, text) => `<!doctype html><meta charset="utf-8"><title>Mindkeep</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1 style="font-size:1.4rem">${title}</h1><p>${text}</p></body>`;
function computerName(raw = hostname()) {
  return raw.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 60) || "computer";
}
function writeConfig(path, server2, key) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ url: server2, key }, null, 2)}
`, { mode: 384 });
  try {
    chmodSync(path, 384);
  } catch {
  }
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
          page("\u041D\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u043E\u0441\u044C", "\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0435 \u043E\u0442 \u044D\u0442\u043E\u0433\u043E \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F. \u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.")
        );
      }
      if (url.searchParams.has("error")) {
        send(200, page("\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E", "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E. \u041E\u043A\u043D\u043E \u043C\u043E\u0436\u043D\u043E \u0437\u0430\u043A\u0440\u044B\u0442\u044C."));
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
        writeConfig(deps.configPath, server2, json.key);
        send(
          200,
          page(
            "\u0413\u043E\u0442\u043E\u0432\u043E",
            "\u042D\u0442\u043E\u0442 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442 \u0441\u0435\u0441\u0441\u0438\u0438 Claude Code \u0432 Mindkeep. \u041E\u043A\u043D\u043E \u043C\u043E\u0436\u043D\u043E \u0437\u0430\u043A\u0440\u044B\u0442\u044C."
          )
        );
        finish(null);
      }).catch((err) => {
        send(502, page("\u041D\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u043E\u0441\u044C", "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437."));
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
        computer: deps.computer ?? computerName()
      });
      const link = `${server2}/connect/autosave?${q.toString()}`;
      deps.say(`Opening the browser to connect this computer to Mindkeep:
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

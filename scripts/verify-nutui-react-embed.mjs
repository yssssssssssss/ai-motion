import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const wsModule = await import(
  pathToFileURL(resolve(repoRoot, "node_modules/.pnpm/ws@8.21.0/node_modules/ws/wrapper.mjs")).href
);
const WebSocket = wsModule.WebSocket ?? wsModule.default;

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

async function waitForJson(url, attempts = 80) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // Server may still be starting.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForHttp(url, attempts = 120) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite may still be starting.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function createCdpClient(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const callbacks = new Map();
  const eventListeners = new Map();
  ws.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    if (message.id && callbacks.has(message.id)) {
      const { resolve, reject } = callbacks.get(message.id);
      callbacks.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method) {
      for (const listener of eventListeners.get(message.method) ?? []) listener(message.params);
    }
  });
  return {
    ready: new Promise((resolveReady, rejectReady) => {
      ws.once("open", resolveReady);
      ws.once("error", rejectReady);
    }),
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolveSend, rejectSend) =>
        callbacks.set(id, { resolve: resolveSend, reject: rejectSend })
      );
    },
    on(method, listener) {
      const bucket = eventListeners.get(method) ?? new Set();
      bucket.add(listener);
      eventListeners.set(method, bucket);
    },
    close() {
      ws.close();
    }
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result.value;
}

function chromeBinary() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Chrome/Chromium not found for NutUI embed verification.");
  return found;
}

function generateEmbedPackage() {
  const output = execFileSync("pnpm", ["verify:embed-package"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  });
  const match = output.match(/"outDir":\s*"([^"]+)"/);
  if (!match?.[1]) throw new Error("Unable to read embed package outDir from verify output.");
  return match[1];
}

async function createNutuiDemo(embedPackageDir) {
  const demoDir = await mkdtemp(join(tmpdir(), "ai-motion-nutui-demo-"));
  await mkdir(join(demoDir, "src/motion-widget"), { recursive: true });
  await mkdir(join(demoDir, "public/motion-widget"), { recursive: true });
  await cp(embedPackageDir, join(demoDir, "src/motion-widget"), { recursive: true });
  await cp(embedPackageDir, join(demoDir, "public/motion-widget"), { recursive: true });
  await writeFile(
    join(demoDir, "package.json"),
    `${JSON.stringify(
      {
        name: "ai-motion-nutui-embed-e2e",
        private: true,
        type: "module",
        scripts: { dev: "vite --host 127.0.0.1" },
        dependencies: {
          "@nutui/nutui-react": "4.0.0-beta.4",
          "@vitejs/plugin-react": "^5.2.0",
          react: "^18.3.1",
          "react-dom": "^18.3.1",
          typescript: "^5.9.3",
          vite: "^7.3.3"
        },
        devDependencies: {}
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    join(demoDir, "index.html"),
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Motion NutUI React E2E</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/App.jsx"></script>
  </body>
</html>
`
  );
  await mkdir(join(demoDir, "src"), { recursive: true });
  await writeFile(
    join(demoDir, "src/App.jsx"),
    `import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@nutui/nutui-react";
import { MotionWidget } from "./motion-widget/react/index.esm.mjs";
import "./motion-widget/dist/style.css";
import "./style.css";

function App() {
  const widgetRef = useRef(null);
  const [params, setParams] = useState({ selectedIndex: 0 });
  const [visible, setVisible] = useState(true);

  return (
    <main className="page">
      <section className="toolbar">
        <Button
          type="primary"
          data-testid="select-two"
          onClick={() => setParams({ selectedIndex: 2, bottomTabbarLabel3: "购物车" })}
        >
          切到购物车
        </Button>
        <Button data-testid="replay" onClick={() => widgetRef.current?.replay()}>
          重播
        </Button>
        <Button data-testid="destroy" onClick={() => setVisible(false)}>
          卸载
        </Button>
      </section>
      <section id="motion-host" className="motion-host">
        {visible ? (
          <MotionWidget
            ref={widgetRef}
            baseUrl="/motion-widget/"
            params={params}
            className="motion-widget-shell"
          />
        ) : null}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
`
  );
  await writeFile(
    join(demoDir, "src/style.css"),
    `html,
body,
#root {
  margin: 0;
  min-height: 100%;
}

.page {
  padding: 16px;
  font-family: system-ui, sans-serif;
}

.toolbar {
  align-items: center;
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.motion-host {
  border: 1px solid #ddd;
  height: 720px;
  overflow: auto;
  width: min(100%, 390px);
}

.motion-widget-shell {
  display: block;
}
`
  );
  return demoDir;
}

async function verifyInChrome(url) {
  const chromePort = await getFreePort();
  const userDataDir = await mkdtemp(join(tmpdir(), "ai-motion-nutui-chrome-"));
  const chrome = spawn(
    chromeBinary(),
    [
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${userDataDir}`,
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank"
    ],
    { stdio: "ignore" }
  );
  let cdp;
  try {
    const version = await waitForJson(`http://127.0.0.1:${chromePort}/json/version`);
    const tabs = await waitForJson(`http://127.0.0.1:${chromePort}/json/list`);
    const tab = tabs.find((item) => item.type === "page") ?? tabs[0];
    cdp = createCdpClient(tab.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    const loaded = new Promise((resolveLoaded) => cdp.on("Page.loadEventFired", resolveLoaded));
    await cdp.send("Page.navigate", { url });
    await loaded;
    await evaluate(
      cdp,
      `new Promise((resolve, reject) => {
      const deadline = Date.now() + 10000;
      function tick() {
        const iframe = document.querySelector('iframe.motion-widget-frame');
        if (iframe && iframe.contentDocument?.readyState === 'complete') return resolve(true);
        if (Date.now() > deadline) return reject(new Error('iframe not ready'));
        setTimeout(tick, 50);
      }
      tick();
    })`
    );
    const before = await evaluate(
      cdp,
      `(() => {
      const iframe = document.querySelector('iframe.motion-widget-frame');
      const doc = iframe.contentDocument;
      const active = doc.querySelector('.bottom-tabbar-item.is-active');
      return {
        nutuiButtonCount: document.querySelectorAll('.nut-button, button').length,
        iframeSrc: iframe.src,
        iframeWidth: iframe.style.width,
        iframeHeight: iframe.style.height,
        activeIndex: Array.from(doc.querySelectorAll('.bottom-tabbar-item')).indexOf(active),
        itemCount: doc.querySelectorAll('.bottom-tabbar-item').length,
        label3: doc.querySelector('[data-motion=bottomTabbarLabel3]')?.textContent
      };
    })()`
    );
    await evaluate(cdp, `document.querySelector('[data-testid="select-two"]')?.click()`);
    const after = await evaluate(
      cdp,
      `new Promise((resolve) => setTimeout(() => {
      const iframe = document.querySelector('iframe.motion-widget-frame');
      const doc = iframe.contentDocument;
      const active = doc.querySelector('.bottom-tabbar-item.is-active, .bottom-tabbar-item.is-activating');
      resolve({
        activeIndex: Array.from(doc.querySelectorAll('.bottom-tabbar-item')).indexOf(active),
        label3: doc.querySelector('[data-motion=bottomTabbarLabel3]')?.textContent,
        moving: Boolean(doc.querySelector('.bottom-tabbar-active-bg.is-moving')),
        iframeWidth: iframe.style.width,
        iframeHeight: iframe.style.height
      });
    }, 160))`
    );
    await evaluate(cdp, `document.querySelector('[data-testid="destroy"]')?.click()`);
    const destroy = await evaluate(
      cdp,
      `({
      iframeCount: document.querySelectorAll('iframe.motion-widget-frame').length
    })`
    );
    const width = Number.parseInt(before.iframeWidth, 10);
    const height = Number.parseInt(before.iframeHeight, 10);
    const passed =
      before.nutuiButtonCount >= 3 &&
      before.iframeSrc.endsWith("/motion-widget/dist/iframe.html") &&
      width > 1000 &&
      height > 2000 &&
      before.activeIndex === 0 &&
      after.activeIndex === 2 &&
      after.label3 === "购物车" &&
      after.moving === true &&
      destroy.iframeCount === 0;
    return { passed, chrome: version.Browser, before, after, destroy };
  } finally {
    cdp?.close();
    chrome.kill("SIGTERM");
    await delay(250);
    if (!chrome.killed) chrome.kill("SIGKILL");
    await rm(userDataDir, { recursive: true, force: true });
  }
}

async function main() {
  const embedPackageDir = generateEmbedPackage();
  const demoDir = await createNutuiDemo(embedPackageDir);
  const port = await getFreePort();
  console.log(`Installing temporary NutUI React demo in ${demoDir}`);
  execFileSync("pnpm", ["install", "--ignore-workspace"], {
    cwd: demoDir,
    stdio: "inherit"
  });
  const vite = spawn("pnpm", ["dev", "--port", String(port)], {
    cwd: demoDir,
    stdio: ["ignore", "pipe", "pipe"]
  });
  try {
    await waitForHttp(`http://127.0.0.1:${port}/`);
    const report = await verifyInChrome(`http://127.0.0.1:${port}/`);
    console.log(JSON.stringify({ ...report, demoDir, page: `http://127.0.0.1:${port}/` }, null, 2));
    if (!report.passed) process.exitCode = 1;
  } finally {
    vite.kill("SIGTERM");
    await delay(250);
    if (!vite.killed) vite.kill("SIGKILL");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

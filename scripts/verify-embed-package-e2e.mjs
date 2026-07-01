import { spawn } from "node:child_process";
import { createServer } from "node:http";
import net from "node:net";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

async function loadWorkspaceModule(path) {
  return import(pathToFileURL(resolve(repoRoot, path)).href);
}

const wsModule = await import(
  pathToFileURL(resolve(repoRoot, "node_modules/.pnpm/ws@8.21.0/node_modules/ws/wrapper.mjs")).href
);
const WebSocket = wsModule.WebSocket ?? wsModule.default;
const ts = await import(
  pathToFileURL(
    resolve(repoRoot, "node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/typescript.js")
  ).href
);

async function loadTsCommonJs(filePath, dependencyMap = {}) {
  const source = await readFile(filePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;
  const module = { exports: {} };
  const require = (specifier) => {
    if (specifier in dependencyMap) return dependencyMap[specifier];
    throw new Error(`Unmapped require ${specifier} from ${filePath}`);
  };
  const fn = new Function("exports", "module", "require", output);
  fn(module.exports, module, require);
  return module.exports;
}

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

async function writePackage(root, files) {
  for (const [path, content] of Object.entries(files)) {
    const absolutePath = join(root, path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }
}

function contentType(path) {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

async function startStaticServer(root) {
  const port = await getFreePort();
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      const pathname = decodeURIComponent(url.pathname === "/" ? "/embed.html" : url.pathname);
      const safePath = pathname.replace(/^\/+/, "");
      const filePath = join(root, safePath);
      if (!filePath.startsWith(root) || !existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "content-type": contentType(filePath) });
      res.end(await readFile(filePath));
    } catch (error) {
      res.writeHead(500);
      res.end(String(error));
    }
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return { server, port };
}

async function waitForJson(url, attempts = 80) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // Chrome may still be starting.
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

async function composeHorizontalSwitchEmbedPackage() {
  const applyPatchModule = await loadTsCommonJs(resolve(repoRoot, "packages/core/src/patch/applyPatch.ts"));
  const exportPackageModule = await loadTsCommonJs(
    resolve(repoRoot, "packages/core/src/export/exportPackage.ts"),
    { "../patch/applyPatch": applyPatchModule }
  );
  const { composeEmbedPackageFiles } = exportPackageModule;
  const sourceRoot = resolve(repoRoot, "packages/components-builtin/jd-horizontal-switch");
  const manifest = JSON.parse(await readFile(join(sourceRoot, "motion.manifest.json"), "utf8"));
  const sourceFiles = {};
  for (const relativePath of [
    "source/index.html",
    "source/style.css",
    "source/script.js",
    "source/assets.css"
  ]) {
    sourceFiles[relativePath] = await readFile(join(sourceRoot, relativePath), "utf8");
  }
  return composeEmbedPackageFiles({
    sourceFiles,
    manifest,
    metadata: { id: "jd-horizontal-switch-e2e", name: manifest.name, sourceKind: manifest.sourceKind },
    patch: { id: "e2e-patch", sourceManifestId: manifest.id, values: {} }
  });
}

function chromeBinary() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Chrome/Chromium not found for embed package e2e verification.");
  return found;
}

async function main() {
  const outDir = await mkdtemp(join(tmpdir(), "ai-motion-embed-e2e-"));
  const userDataDir = await mkdtemp(join(tmpdir(), "ai-motion-chrome-"));
  const files = await composeHorizontalSwitchEmbedPackage();
  await writePackage(outDir, files);
  const { server, port } = await startStaticServer(outDir);
  const chromePort = await getFreePort();
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
    const pageLoaded = new Promise((resolveLoaded) => cdp.on("Page.loadEventFired", resolveLoaded));
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${port}/embed.html` });
    await pageLoaded;
    await delay(200);
    await evaluate(
      cdp,
      `(() => {
      window.__motionWidget = window.AiMotionWidget.mountMotionWidget('#motion-slot', {
        baseUrl: './',
        params: { selectedIndex: 0 }
      });
      return true;
    })()`
    );
    await evaluate(
      cdp,
      `new Promise((resolve, reject) => {
      const deadline = Date.now() + 5000;
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
      const root = doc.querySelector('[data-motion-root]');
      const tabbar = doc.querySelector('.bottom-tabbar');
      const rootRect = root?.getBoundingClientRect();
      const tabbarRect = tabbar?.getBoundingClientRect();
      return {
        iframeSrc: iframe.src,
        iframeWidth: iframe.style.width,
        iframeHeight: iframe.style.height,
        rootRect: rootRect ? { width: rootRect.width, height: rootRect.height } : null,
        tabbarRect: tabbarRect ? { width: tabbarRect.width, height: tabbarRect.height } : null,
        activeIndex: Array.from(doc.querySelectorAll('.bottom-tabbar-item')).indexOf(active),
        itemCount: doc.querySelectorAll('.bottom-tabbar-item').length,
        hasRuntime: typeof window.AiMotionWidget?.mountMotionWidget === 'function',
        hasPinkBackground: doc.documentElement.innerHTML.includes('#ffeef2')
      };
    })()`
    );
    const after = await evaluate(
      cdp,
      `new Promise((resolve) => {
      window.__motionWidget.update({ selectedIndex: 2, bottomTabbarLabel3: '购物车' });
      setTimeout(() => {
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
      }, 120);
    })`
    );
    const destroy = await evaluate(
      cdp,
      `(() => {
      window.__motionWidget.destroy();
      return { iframeCount: document.querySelectorAll('iframe.motion-widget-frame').length };
    })()`
    );
    const width = Number.parseInt(before.iframeWidth, 10);
    const height = Number.parseInt(before.iframeHeight, 10);
    const passed =
      before.hasRuntime &&
      before.itemCount === 5 &&
      before.activeIndex === 0 &&
      before.iframeSrc.endsWith("/dist/iframe.html") &&
      width > 1000 &&
      height > 2000 &&
      after.activeIndex === 2 &&
      after.label3 === "购物车" &&
      after.moving === true &&
      destroy.iframeCount === 0;
    const report = {
      passed,
      outDir,
      page: `http://127.0.0.1:${port}/embed.html`,
      chrome: version.Browser,
      before,
      after,
      destroy
    };
    console.log(JSON.stringify(report, null, 2));
    if (!passed) process.exitCode = 1;
  } finally {
    cdp?.close();
    server.close();
    chrome.kill("SIGTERM");
    await delay(250);
    if (!chrome.killed) chrome.kill("SIGKILL");
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

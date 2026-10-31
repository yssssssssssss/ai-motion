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
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return { server, port };
}

async function waitForJson(url) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
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
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        "Runtime evaluation failed"
    );
  }
  return result.result.value;
}

async function loadEmbedExporter() {
  const applyPatchModule = await loadTsCommonJs(resolve(repoRoot, "packages/core/src/patch/applyPatch.ts"));
  const resolveLocalAssetPathModule = await loadTsCommonJs(
    resolve(repoRoot, "packages/core/src/import/resolveLocalAssetPath.ts")
  );
  const exportPackageModule = await loadTsCommonJs(
    resolve(repoRoot, "packages/core/src/export/exportPackage.ts"),
    {
      "../patch/applyPatch": applyPatchModule,
      "../import/resolveLocalAssetPath": resolveLocalAssetPathModule
    }
  );
  return exportPackageModule.composeEmbedPackageFiles;
}

async function composeHorizontalSwitchEmbedPackage(composeEmbedPackageFiles) {
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

function composeFixtureEmbedPackage(composeEmbedPackageFiles) {
  const manifest = {
    version: "1.0",
    id: "embed-contract-fixture",
    name: "Embed contract fixture",
    sourceKind: "html-package",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    params: [
      {
        id: "tabLabel3",
        label: "Third tab",
        type: "text",
        default: "Tab 3",
        status: "confirmed",
        targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=tabLabel3]" }]
      },
      {
        id: "accentColor",
        label: "Active tab color",
        type: "color",
        default: "#13579b",
        status: "confirmed",
        targets: [
          {
            kind: "css-variable",
            file: "source/style.css",
            selector: "[data-motion-root]",
            name: "--accent-color"
          }
        ]
      }
    ]
  };
  return composeEmbedPackageFiles({
    manifest,
    metadata: { id: manifest.id, name: manifest.name },
    patch: { id: "fixture-patch", sourceManifestId: manifest.id, values: {} },
    sourceFiles: {
      "source/index.html": `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="./style.css" />
    <style>#inline-proof { color: rgb(12, 34, 56); }</style>
  </head>
  <body>
    <main data-motion-root>
      <nav>${Array.from({ length: 5 }, (_, index) => `<button class="bottom-tabbar-item" data-bottom-tab="${index}"><span${index === 2 ? ' data-motion="tabLabel3"' : ""}>Tab ${index + 1}</span></button>`).join("")}</nav>
      <span id="inline-proof">Inline style</span>
      <div class="clipped"><div class="offscreen"></div></div>
      <div class="visible"><div class="overflowing"></div></div>
    </main>
    <script src="./script.js"></script>
    <script>if (window.__linkedRan !== true) throw new Error("Linked script must run first"); window.__inlineRan = true;</script>
    <script type="application/json" id="cfg">{"__jsonRan":true,"items":[1,2,3]}</script>
    <script type="module">window.__moduleRan = true;</script>
  </body>
</html>`,
      "source/style.css": `html, body { margin: 0; }
[data-motion-root] { --accent-color: #13579b; position: relative; width: 320px; height: 180px; }
nav { display: flex; height: 24px; }
.bottom-tabbar-item { border: 0; padding: 0; width: 50px; height: 24px; }
.bottom-tabbar-item.is-active { background-color: var(--accent-color); }
.clipped { position: absolute; left: 10px; top: 30px; width: 40px; height: 40px; overflow: hidden; }
.offscreen { position: absolute; left: 2000px; top: 3000px; width: 150px; height: 150px; }
.visible { position: absolute; left: 280px; top: 140px; width: 40px; height: 40px; overflow: visible; }
.overflowing { position: absolute; left: 40px; top: 40px; width: 80px; height: 40px; }`,
      "source/script.js": `window.__linkedRan = true;
const tabs = Array.from(document.querySelectorAll(".bottom-tabbar-item"));
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    for (const item of tabs) item.classList.toggle("is-active", item === tab);
  });
}
tabs[0].click();`
    }
  });
}

function composeViewportFixtureEmbedPackage(composeEmbedPackageFiles) {
  const manifest = {
    version: "1.0",
    id: "viewport-fixture",
    name: "Viewport fixture",
    sourceKind: "html-package",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    params: []
  };
  return composeEmbedPackageFiles({
    manifest,
    metadata: { id: manifest.id },
    patch: { id: "viewport-patch", sourceManifestId: manifest.id, values: {} },
    sourceFiles: {
      "source/index.html": `<link rel="stylesheet" href="./style.css" />
<main data-motion-root><div></div></main><script src="./script.js"></script>`,
      "source/style.css": `html, body { margin: 0; }
[data-motion-root] { width: 100vw; overflow: hidden; }
[data-motion-root] > div { width: 64px; height: 48px; }`,
      "source/script.js": `const NativeResizeObserver = window.ResizeObserver;
window.__resizeWidths = [];
window.ResizeObserver = class extends NativeResizeObserver {
  constructor(callback) {
    super((entries, observer) => {
      window.__resizeWidths.push(window.innerWidth);
      callback(entries, observer);
    });
  }
};`
    }
  });
}

function hostHtml() {
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>html, body { margin: 0; }</style></head><body>
<div id="motion-slot"></div><script src="./dist/index.umd.js"></script></body></html>`;
}

function pollBrowser(predicate, description) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 10000;
    function tick() {
      try {
        const result = predicate();
        if (result) return resolve(result);
        if (Date.now() >= deadline) return reject(new Error(`Timed out waiting for ${description}`));
        setTimeout(tick, 25);
      } catch (error) {
        reject(error);
      }
    }
    tick();
  });
}

async function fixtureScenario(poll) {
  let ready = false;
  const errors = [];
  const widget = window.AiMotionWidget.mountMotionWidget("#motion-slot", {
    baseUrl: "./",
    params: { selectedIndex: 0 },
    onReady: () => {
      ready = true;
    },
    onError: (error) => errors.push(error.message)
  });
  try {
    await poll(() => ready, "fixture ai-motion:ready callback");
    const frame = widget.frame;
    const doc = frame.contentDocument;
    await poll(
      () => frame.style.width === "400px" && frame.style.height === "220px",
      "fixture content size 400×220 (clipped child excluded, visible overflow included)"
    );
    const tabs = Array.from(doc.querySelectorAll(".bottom-tabbar-item"));
    const activeIndex = () => tabs.findIndex((tab) => tab.classList.contains("is-active"));
    await poll(() => activeIndex() === 0, "initial fixture tab selection");
    const cfg = doc.querySelector("#cfg");
    const before = {
      inlineColor: frame.contentWindow.getComputedStyle(doc.querySelector("#inline-proof")).color,
      inlineRan: frame.contentWindow.__inlineRan === true,
      jsonType: cfg?.type,
      jsonText: cfg?.textContent,
      jsonInert: frame.contentWindow.__jsonRan === undefined,
      moduleSkipped:
        !doc.querySelector('script[type="module"]') && frame.contentWindow.__moduleRan === undefined,
      itemCount: tabs.length,
      activeIndex: activeIndex(),
      styleWidth: frame.style.width,
      width: Number.parseFloat(frame.style.width),
      height: Number.parseFloat(frame.style.height)
    };
    widget.update({ selectedIndex: 2, tabLabel3: "购物车", accentColor: "#e92a45" });
    await poll(
      () =>
        activeIndex() === 2 &&
        doc.querySelector("[data-motion=tabLabel3]")?.textContent === "购物车" &&
        frame.contentWindow.getComputedStyle(tabs[2]).backgroundColor === "rgb(233, 42, 69)",
      "fixture selection, html-text and CSS-variable updates"
    );
    const after = {
      activeIndex: activeIndex(),
      label: doc.querySelector("[data-motion=tabLabel3]")?.textContent,
      accentColor: frame.contentWindow.getComputedStyle(tabs[2]).backgroundColor
    };
    widget.destroy();
    await poll(() => !document.querySelector("iframe.motion-widget-frame"), "fixture iframe removal");
    const checks = {
      inlineStyleApplied: before.inlineColor === "rgb(12, 34, 56)",
      classicScriptsInOrder: before.inlineRan,
      jsonPreservedAndInert:
        before.jsonType === "application/json" &&
        before.jsonInert &&
        JSON.stringify(JSON.parse(before.jsonText)) === JSON.stringify({ __jsonRan: true, items: [1, 2, 3] }),
      moduleSkipped: before.moduleSkipped,
      fiveTabs: before.itemCount === 5 && before.activeIndex === 0,
      selectionUpdated: after.activeIndex === 2,
      textUpdated: after.label === "购物车",
      cssVariableUpdated: after.accentColor === "rgb(233, 42, 69)",
      contentSize: before.width === 400 && before.height === 220,
      fixedPixelWidth: before.styleWidth === "400px",
      noRuntimeErrors: errors.length === 0,
      destroyed: !document.querySelector("iframe.motion-widget-frame")
    };
    return { checks, before, after, errors };
  } finally {
    widget.destroy();
  }
}

async function builtinScenario(poll) {
  let ready = false;
  const errors = [];
  const widget = window.AiMotionWidget.mountMotionWidget("#motion-slot", {
    baseUrl: "./",
    onReady: () => {
      ready = true;
    },
    onError: (error) => errors.push(error.message)
  });
  try {
    await poll(() => ready, "builtin ai-motion:ready callback");
    const frame = widget.frame;
    const root = frame.contentDocument.querySelector("[data-motion-root]");
    function measure() {
      const rect = root.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      return {
        rootWidth: rect.width,
        rootHeight: rect.height,
        iframeWidth: frameRect.width,
        iframeHeight: frameRect.height,
        styleWidth: frame.style.width,
        styleHeight: frame.style.height,
        maxWidth: frame.style.maxWidth,
        documentScrollWidth: frame.contentDocument.documentElement.scrollWidth,
        bodyScrollWidth: frame.contentDocument.body.scrollWidth,
        hostScrollWidth: document.documentElement.scrollWidth,
        hostWidth: document.documentElement.clientWidth
      };
    }
    function converged(size, width) {
      return (
        Math.abs(size.rootWidth - width) <= 1 &&
        Math.abs(size.iframeWidth - width) <= 1 &&
        size.rootHeight > 500 &&
        Math.abs(size.iframeHeight - size.rootHeight) <= 1 &&
        Math.abs(Number.parseFloat(size.styleHeight) - size.rootHeight) <= 1
      );
    }
    async function settle(width) {
      await poll(() => converged(measure(), width), `builtin ${width}px width and converged height`);
      const first = measure();
      await new Promise((resolve) => setTimeout(resolve, 300));
      const second = measure();
      return {
        first,
        second,
        correctSize: converged(first, width) && converged(second, width),
        stable: first.iframeWidth === second.iframeWidth && first.iframeHeight === second.iframeHeight
      };
    }
    const wide = await settle(1545);
    document.querySelector("#motion-slot").style.width = "800px";
    const narrow = await settle(800);
    const hasReplay = typeof frame.contentWindow.motionReplay === "function";
    widget.destroy();
    await poll(() => !document.querySelector("iframe.motion-widget-frame"), "builtin iframe removal");
    return {
      checks: {
        wideHostViewport: wide.first.hostWidth === 2048,
        wideContentSize: wide.correctSize,
        narrowContentSize: narrow.correctSize,
        wideStable: wide.stable,
        narrowStable: narrow.stable,
        fluidWidth: wide.second.styleWidth === "100%" && narrow.second.styleWidth === "100%",
        naturalCapRetained: wide.second.maxWidth === "1545px" && narrow.second.maxWidth === "1545px",
        replayAvailable: hasReplay,
        noHostHorizontalOverflow: [wide, narrow].every(({ first, second }) =>
          [first, second].every((size) => size.hostScrollWidth <= size.hostWidth)
        ),
        noRuntimeErrors: errors.length === 0,
        destroyed: !document.querySelector("iframe.motion-widget-frame")
      },
      observed: { wide, narrow },
      errors
    };
  } finally {
    widget.destroy();
  }
}

async function viewportFixtureScenario(poll) {
  const slot = document.querySelector("#motion-slot");
  slot.style.width = "800px";
  let ready = false;
  const errors = [];
  const widget = window.AiMotionWidget.mountMotionWidget(slot, {
    baseUrl: "./",
    onReady: () => {
      ready = true;
    },
    onError: (error) => errors.push(error.message)
  });
  try {
    await poll(() => ready, "viewport fixture ready");
    const frame = widget.frame;
    const root = frame.contentDocument.querySelector("[data-motion-root]");
    await poll(() => {
      const rect = root.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      return (
        Math.abs(rect.width - 800) <= 1 &&
        Math.abs(frameRect.width - 800) <= 1 &&
        rect.height === 48 &&
        Math.abs(frameRect.height - rect.height) <= 1 &&
        frame.contentWindow.__resizeWidths.includes(800)
      );
    }, "100vw fixture fills 800px container and ResizeObserver reports the first widening");
    const observed = {
      rootWidth: root.getBoundingClientRect().width,
      rootHeight: root.getBoundingClientRect().height,
      iframeWidth: frame.getBoundingClientRect().width,
      iframeHeight: frame.getBoundingClientRect().height,
      styleWidth: frame.style.width,
      resizeWidths: [...frame.contentWindow.__resizeWidths]
    };
    return {
      checks: {
        fillsContainer: Math.abs(observed.rootWidth - 800) <= 1 && Math.abs(observed.iframeWidth - 800) <= 1,
        exactHeight: observed.rootHeight === 48 && observed.iframeHeight === 48,
        responsive: observed.styleWidth === "100%",
        observerAfterWidening: observed.resizeWidths.includes(800),
        noHostHorizontalOverflow:
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        noRuntimeErrors: errors.length === 0
      },
      observed,
      errors
    };
  } finally {
    widget.destroy();
  }
}

async function runScenario(cdp, url, name, scenario, extraChecks = {}) {
  try {
    await cdp.send("Page.navigate", { url });
    const deadline = Date.now() + 10000;
    let loaded = false;
    while (Date.now() < deadline) {
      try {
        loaded = await evaluate(
          cdp,
          `window.location.href === ${JSON.stringify(url)} && typeof window.AiMotionWidget?.mountMotionWidget === "function"`
        );
      } catch {
        // Navigation can replace the execution context between polls.
      }
      if (loaded) break;
      await delay(25);
    }
    if (!loaded) throw new Error(`Timed out loading ${name} host runtime`);
    const result = await evaluate(cdp, `(${scenario.toString()})(${pollBrowser.toString()})`);
    const checks = { ...extraChecks, ...result.checks };
    return { name, ...result, checks, passed: Object.values(checks).every((value) => value === true) };
  } catch (error) {
    return { name, passed: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function stopChrome(chrome) {
  if (chrome.exitCode !== null || chrome.signalCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => chrome.kill("SIGKILL"), 3000);
    chrome.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    chrome.kill("SIGTERM");
  });
}

async function main() {
  const outDir = await mkdtemp(join(tmpdir(), "ai-motion-embed-e2e-"));
  const userDataDir = await mkdtemp(join(tmpdir(), "ai-motion-chrome-"));
  let server;
  let chrome;
  let cdp;
  try {
    const composeEmbedPackageFiles = await loadEmbedExporter();
    const fixtureFiles = composeFixtureEmbedPackage(composeEmbedPackageFiles);
    const builtinFiles = await composeHorizontalSwitchEmbedPackage(composeEmbedPackageFiles);
    const viewportFiles = composeViewportFixtureEmbedPackage(composeEmbedPackageFiles);
    await writePackage(join(outDir, "fixture"), { ...fixtureFiles, "host.html": hostHtml() });
    await writePackage(join(outDir, "builtin"), { ...builtinFiles, "host.html": hostHtml() });
    await writePackage(join(outDir, "viewport"), { ...viewportFiles, "host.html": hostHtml() });
    const serving = await startStaticServer(outDir);
    server = serving.server;
    const chromePort = await getFreePort();
    chrome = spawn(
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
    const version = await waitForJson(`http://127.0.0.1:${chromePort}/json/version`);
    const tabs = await waitForJson(`http://127.0.0.1:${chromePort}/json/list`);
    const tab = tabs.find((item) => item.type === "page") ?? tabs[0];
    cdp = createCdpClient(tab.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 2048,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false
    });
    const warnings = JSON.parse(String(fixtureFiles["manifest.json"])).warnings ?? [];
    const moduleWarning = warnings.find((warning) => warning.code === "module-script-skipped");
    const scenarios = [];
    const baseUrl = `http://127.0.0.1:${serving.port}`;
    scenarios.push(
      await runScenario(cdp, `${baseUrl}/fixture/host.html`, "self-contained fixture", fixtureScenario, {
        moduleWarningInManifest: Boolean(moduleWarning),
        moduleWarningInReadme: Boolean(
          moduleWarning && String(fixtureFiles["README.md"]).includes(moduleWarning.message)
        )
      })
    );
    scenarios.push(
      await runScenario(cdp, `${baseUrl}/builtin/host.html`, "jd-horizontal-switch smoke", builtinScenario)
    );
    scenarios.push(
      await runScenario(
        cdp,
        `${baseUrl}/viewport/host.html`,
        "100vw clipped fixture",
        viewportFixtureScenario
      )
    );
    const passed = scenarios.every((scenario) => scenario.passed);
    const fixturePackageDir = join(outDir, "fixture");
    console.log(
      JSON.stringify({ passed, outDir, fixturePackageDir, chrome: version.Browser, scenarios }, null, 2)
    );
    if (!passed) process.exitCode = 1;
  } finally {
    cdp?.close();
    server?.close();
    if (chrome) await stopChrome(chrome);
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

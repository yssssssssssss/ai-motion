#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

function parseArgs(argv) {
  const args = {
    threshold: 0.04,
    width: undefined,
    height: undefined,
    fromWidth: undefined,
    fromHeight: undefined,
    toWidth: undefined,
    toHeight: undefined
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--")) continue;
    if (value == null || value.startsWith("--")) {
      args[key.slice(2)] = true;
      continue;
    }
    args[key.slice(2)] = value;
    index += 1;
  }
  args.threshold = Number(args.threshold ?? 0.04);
  args.width = args.width == null ? undefined : Number(args.width);
  args.height = args.height == null ? undefined : Number(args.height);
  args.fromWidth = args["from-width"] == null ? undefined : Number(args["from-width"]);
  args.fromHeight = args["from-height"] == null ? undefined : Number(args["from-height"]);
  args.toWidth = args["to-width"] == null ? undefined : Number(args["to-width"]);
  args.toHeight = args["to-height"] == null ? undefined : Number(args["to-height"]);
  return args;
}

function requireString(args, name) {
  const value = args[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing --${name}`);
  }
  return value.trim();
}

function checkpointFileName(progress) {
  return `${Math.round(progress * 100)}.png`;
}

function parseCheckpoints(args) {
  const raw = args.checkpoints ?? args.progresses ?? "0,0.25,0.5,0.75,1";
  const values = String(raw)
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
  if (args["mid-progress"] != null) {
    const midpoint = Number(args["mid-progress"]);
    if (Number.isFinite(midpoint) && midpoint > 0 && midpoint < 1) values.push(midpoint);
  }
  const checkpoints = [...new Set(values)].sort((left, right) => left - right);
  if (checkpoints[0] !== 0 || checkpoints.at(-1) !== 1) {
    throw new Error("--checkpoints must include both 0 and 1 so the endpoint pixel gate remains active.");
  }
  return checkpoints;
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

async function waitForExit(child, timeoutMs = 2000) {
  if (child.exitCode != null || child.signalCode != null) return;
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(timeoutMs)]);
}

async function removeDirWithRetry(path, attempts = 5) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      await rm(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (index === attempts - 1) throw error;
      await delay(150);
    }
  }
}

function createCdpClient(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const callbacks = new Map();
  const eventListeners = new Map();
  ws.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    if (message.id && callbacks.has(message.id)) {
      const { resolve: resolveCallback, reject } = callbacks.get(message.id);
      callbacks.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolveCallback(message.result);
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
      return new Promise((resolveSend, reject) => callbacks.set(id, { resolve: resolveSend, reject }));
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
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium"
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Chrome/Chromium not found for Zero visual export verification.");
  return found;
}

async function navigate(cdp, url) {
  const loaded = new Promise((resolveLoaded) => cdp.on("Page.loadEventFired", resolveLoaded));
  await cdp.send("Page.navigate", { url });
  await loaded;
}

function urlWithProgress(url, progress) {
  const parsed = new URL(url);
  parsed.searchParams.set("mc-progress", String(progress));
  return parsed.href;
}

function stageSelectorExpression() {
  return `document.querySelector(".mc-zero-stage") || document.querySelector(".mc-zero-layer-stage")`;
}

async function dataUrlForImageSource(source) {
  if (/^data:/.test(source)) return source;
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Failed to fetch screenshot ${source}: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }
  const buffer = await readFile(resolve(process.cwd(), source));
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function writeDataUrl(path, dataUrl) {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) throw new Error(`Cannot write non-base64 data URL to ${path}`);
  await writeFile(path, Buffer.from(match[1], "base64"));
}

async function compareInBrowser(cdp, actualDataUrl, expectedDataUrl, width, height, threshold) {
  return evaluate(
    cdp,
    `(${async function compare(actual, expected, w, h, maxDifferenceRatio) {
      async function pixels(src) {
        const image = new Image();
        image.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = src;
        });
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.fillStyle = "#fff";
        context.fillRect(0, 0, w, h);
        context.drawImage(image, 0, 0, w, h);
        return context.getImageData(0, 0, w, h).data;
      }
      const actualPixels = await pixels(actual);
      const expectedPixels = await pixels(expected);
      let changedPixels = 0;
      const totalPixels = w * h;
      for (let index = 0; index < actualPixels.length; index += 4) {
        const delta =
          Math.abs(actualPixels[index] - expectedPixels[index]) +
          Math.abs(actualPixels[index + 1] - expectedPixels[index + 1]) +
          Math.abs(actualPixels[index + 2] - expectedPixels[index + 2]) +
          Math.abs(actualPixels[index + 3] - expectedPixels[index + 3]);
        if (delta > 8) changedPixels += 1;
      }
      const differenceRatio = changedPixels / Math.max(1, totalPixels);
      return {
        passed: differenceRatio <= maxDifferenceRatio,
        differenceRatio,
        maxDifferenceRatio,
        changedPixels,
        totalPixels
      };
    }})(${JSON.stringify(actualDataUrl)}, ${JSON.stringify(expectedDataUrl)}, ${width}, ${height}, ${threshold})`
  );
}

async function imageSizeInBrowser(cdp, dataUrl) {
  return evaluate(
    cdp,
    `(${async function imageSize(src) {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = src;
      });
      return { width: image.naturalWidth, height: image.naturalHeight };
    }})(${JSON.stringify(dataUrl)})`
  );
}

async function captureStage(cdp, htmlUrl, progress, width, height) {
  await navigate(cdp, urlWithProgress(htmlUrl, progress));
  await evaluate(
    cdp,
    `(() => {
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
    })()`
  );
  await delay(100);
  const clip = await evaluate(
    cdp,
    `(() => {
      const stage = ${stageSelectorExpression()};
      if (!stage) throw new Error("Missing .mc-zero-stage or .mc-zero-layer-stage in exported HTML.");
      const rect = stage.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 };
    })()`
  );
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    omitBackground: true,
    clip: {
      x: clip.x,
      y: clip.y,
      width: width ?? clip.width,
      height: height ?? clip.height,
      scale: 1
    }
  });
  return `data:image/png;base64,${screenshot.data}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const html = requireString(args, "html");
  const from = requireString(args, "from");
  const to = requireString(args, "to");
  const threshold = Number.isFinite(args.threshold) ? args.threshold : 0.04;
  const checkpoints = parseCheckpoints(args);
  const reportOutput = typeof args["report-output"] === "string" ? args["report-output"].trim() : undefined;
  const baselineDir = typeof args["baseline-dir"] === "string" ? args["baseline-dir"].trim() : undefined;
  const debugDir = typeof args["debug-dir"] === "string" ? args["debug-dir"].trim() : undefined;
  const updateBaseline = args["update-baseline"] === true;
  if (updateBaseline && !baselineDir) throw new Error("--update-baseline requires --baseline-dir.");
  const userDataDir = await mkdtemp(join(tmpdir(), "ai-motion-zero-verify-chrome-"));
  const chromePort = await getFreePort();
  const htmlUrl = /^https?:\/\//.test(html) ? html : pathToFileURL(resolve(process.cwd(), html)).href;
  const chrome = spawn(
    chromeBinary(),
    [
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${userDataDir}`,
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      // CI 的 Linux runner 不支持 Chrome 沙箱
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
      "about:blank"
    ],
    { stdio: "ignore" }
  );

  let cdp;
  try {
    const tabs = await waitForJson(`http://127.0.0.1:${chromePort}/json/list`);
    const tab = tabs.find((item) => item.type === "page") ?? tabs[0];
    cdp = createCdpClient(tab.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: Math.ceil(args.width ?? 800),
      height: Math.ceil(args.height ?? 600),
      deviceScaleFactor: 1,
      mobile: false
    });
    await navigate(cdp, urlWithProgress(htmlUrl, 0));
    await delay(200);

    const stageSize = await evaluate(
      cdp,
      `(() => {
        const stage = ${stageSelectorExpression()};
        if (!stage) throw new Error("Missing .mc-zero-stage or .mc-zero-layer-stage in exported HTML.");
        const rect = stage.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      })()`
    );

    const embeddedReport = await evaluate(
      cdp,
      `(() => {
        const el = document.querySelector('script#motion-report[type="application/json"]');
        if (!el) return null;
        try { return JSON.parse(el.textContent); } catch { return null; }
      })()`
    );

    const fromExpected = await dataUrlForImageSource(from);
    const toExpected = await dataUrlForImageSource(to);
    const fromExpectedSize = await imageSizeInBrowser(cdp, fromExpected);
    const toExpectedSize = await imageSizeInBrowser(cdp, toExpected);
    const fromWidth = Math.round(args.fromWidth ?? args.width ?? fromExpectedSize.width ?? stageSize.width);
    const fromHeight = Math.round(
      args.fromHeight ?? args.height ?? fromExpectedSize.height ?? stageSize.height
    );
    const toWidth = Math.round(args.toWidth ?? args.width ?? toExpectedSize.width ?? stageSize.width);
    const toHeight = Math.round(args.toHeight ?? args.height ?? toExpectedSize.height ?? stageSize.height);
    if (debugDir) await mkdir(resolve(process.cwd(), debugDir), { recursive: true });
    if (baselineDir && updateBaseline) await mkdir(resolve(process.cwd(), baselineDir), { recursive: true });
    const captures = [];
    for (const progress of checkpoints) {
      const width = progress === 0 ? fromWidth : progress === 1 ? toWidth : stageSize.width;
      const height = progress === 0 ? fromHeight : progress === 1 ? toHeight : stageSize.height;
      const actual = await captureStage(cdp, htmlUrl, progress, width, height);
      const endpointExpected = progress === 0 ? fromExpected : progress === 1 ? toExpected : undefined;
      const baselinePath = baselineDir
        ? resolve(process.cwd(), baselineDir, checkpointFileName(progress))
        : undefined;
      const baselineExpected =
        baselinePath && existsSync(baselinePath) ? await dataUrlForImageSource(baselinePath) : undefined;
      const expected = endpointExpected ?? baselineExpected;
      const diff = expected
        ? await compareInBrowser(cdp, actual, expected, width, height, threshold)
        : undefined;
      if (debugDir)
        await writeDataUrl(join(resolve(process.cwd(), debugDir), checkpointFileName(progress)), actual);
      if (baselineDir && updateBaseline) {
        await writeDataUrl(join(resolve(process.cwd(), baselineDir), checkpointFileName(progress)), actual);
      }
      captures.push({
        progress,
        size: { width, height },
        actual,
        comparison: endpointExpected ? "endpoint" : baselineExpected ? "baseline" : "captured",
        ...(diff ? { diff } : {})
      });
    }
    const fromCapture = captures.find((capture) => capture.progress === 0);
    const toCapture = captures.find((capture) => capture.progress === 1);
    if (!fromCapture?.diff || !toCapture?.diff)
      throw new Error("Endpoint captures are required for visual verification.");
    const fromDiff = fromCapture.diff;
    const toDiff = toCapture.diff;
    const intermediateFailures = captures.filter(
      (capture) => capture.progress > 0 && capture.progress < 1 && capture.diff && !capture.diff.passed
    );
    const checkpointsReport = captures.map((capture) => {
      const report = { ...capture };
      delete report.actual;
      return report;
    });

    const diffIssues = [];
    if (!fromDiff.passed) {
      diffIssues.push({
        id: "visual-diff-from",
        severity: "error",
        source: "render-risk",
        category: "visual-diff",
        title: `首帧截图差异超阈值 (${(fromDiff.differenceRatio * 100).toFixed(1)}% > ${(threshold * 100).toFixed(1)}%)`,
        frame: "from",
        differenceRatio: fromDiff.differenceRatio
      });
    }
    if (!toDiff.passed) {
      diffIssues.push({
        id: "visual-diff-to",
        severity: "error",
        source: "render-risk",
        category: "visual-diff",
        title: `尾帧截图差异超阈值 (${(toDiff.differenceRatio * 100).toFixed(1)}% > ${(threshold * 100).toFixed(1)}%)`,
        frame: "to",
        differenceRatio: toDiff.differenceRatio
      });
    }
    for (const capture of intermediateFailures) {
      diffIssues.push({
        id: `visual-diff-${Math.round(capture.progress * 100)}`,
        severity: "error",
        source: "render-risk",
        category: "visual-diff",
        title: `${Math.round(capture.progress * 100)}% 截帧与基线差异超阈值 (${(capture.diff.differenceRatio * 100).toFixed(1)}% > ${(threshold * 100).toFixed(1)}%)`,
        progress: capture.progress,
        differenceRatio: capture.diff.differenceRatio
      });
    }

    const enrichedReport = embeddedReport
      ? {
          ...embeddedReport,
          verifyIssues: diffIssues,
          verifyResult: { fromDiff, toDiff, checkpoints: checkpointsReport, threshold }
        }
      : diffIssues.length > 0
        ? {
            verifyIssues: diffIssues,
            verifyResult: { fromDiff, toDiff, checkpoints: checkpointsReport, threshold }
          }
        : null;

    if (reportOutput && enrichedReport) {
      await writeFile(resolve(process.cwd(), reportOutput), JSON.stringify(enrichedReport, null, 2));
    }

    const result = {
      passed: Boolean(fromDiff.passed && toDiff.passed && intermediateFailures.length === 0),
      threshold,
      stage: stageSize,
      fromSize: { width: fromWidth, height: fromHeight },
      toSize: { width: toWidth, height: toHeight },
      from: fromDiff,
      to: toDiff,
      checkpoints: checkpointsReport,
      embeddedReport: embeddedReport
        ? { score: embeddedReport.score, issueCount: embeddedReport.issues?.length ?? 0 }
        : null,
      diffIssues
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.passed) process.exitCode = 1;
  } finally {
    cdp?.close();
    chrome.kill();
    await waitForExit(chrome);
    await removeDirWithRetry(userDataDir);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

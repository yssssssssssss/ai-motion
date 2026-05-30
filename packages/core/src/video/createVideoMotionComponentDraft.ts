import type { MotionComponent, SourceFile } from "../library/componentLibrary";
import type { MotionManifest, MotionParam } from "../manifest/types";
import type {
  MotionPlan,
  UploadedVideoInput,
  VerificationCheck,
  VideoConversionJob,
  VideoMotionComponentDraft
} from "./types";

type CreateVideoMotionComponentDraftInput = {
  id: string;
  name: string;
  video: UploadedVideoInput;
};

type MotionFrame = {
  id: string;
  timestampMs: number;
  dataUrl: string;
};

type FrameTiming = MotionFrame & {
  startPercent: number;
  endPercent: number;
};

function clampNumber(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function toCssString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function hasMotionHints(video: UploadedVideoInput): boolean {
  return (
    video.motionHints !== undefined &&
    video.motionHints.direction !== "none" &&
    video.motionHints.confidence > 0
  );
}

function normalizedFrames(video: UploadedVideoInput): MotionFrame[] {
  const frames =
    video.frames
      ?.filter((frame) => frame.dataUrl.trim().length > 0)
      .slice(0, 6)
      .map((frame, index) => ({
        id: frame.id || `frame-${index}`,
        timestampMs: clampNumber(frame.timestampMs, index, 0, 600000),
        dataUrl: frame.dataUrl
      })) ?? [];

  if (frames.length > 0) return frames;
  if (video.posterDataUrl) return [{ id: "poster", timestampMs: 0, dataUrl: video.posterDataUrl }];
  return [];
}

function percent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function frameTimings(frames: MotionFrame[], durationMs: number): FrameTiming[] {
  if (frames.length === 0) return [];
  const sorted = [...frames].sort((a, b) => a.timestampMs - b.timestampMs);

  return sorted.map((frame, index) => {
    const next = sorted[index + 1];
    const startMs = clampNumber(frame.timestampMs, 0, 0, durationMs);
    const endMs = next ? clampNumber(next.timestampMs, durationMs, startMs, durationMs) : durationMs;

    return {
      ...frame,
      startPercent: (startMs / durationMs) * 100,
      endPercent: (endMs / durationMs) * 100
    };
  });
}

function frameKeyframes(frames: FrameTiming[]): string {
  return frames
    .map((frame, index) => {
      const start = percent(frame.startPercent);
      const end = percent(frame.endPercent);

      return `@keyframes frame-${index} {
  0%,
  100% { opacity: 0; }
  ${start}% { opacity: 1; }
  ${end}% { opacity: 1; }
}`;
    })
    .join("\n\n");
}

function createJob(id: string): VideoConversionJob {
  const now = new Date().toISOString();
  return {
    id: `${id}-conversion`,
    status: "completed",
    progress: 100,
    currentStep: "completed",
    message: "已生成首版代码动效组件",
    startedAt: now,
    completedAt: now
  };
}

function createPlan(video: UploadedVideoInput): MotionPlan {
  const width = clampNumber(video.width, 390, 120, 1920);
  const height = clampNumber(video.height, 844, 120, 1920);
  const durationMs = clampNumber(video.durationMs, 1200, 120, 10000);
  const fps = clampNumber(video.fps, 30, 1, 120);
  const shouldAnimateLayer = hasMotionHints(video);
  const motionHints = video.motionHints;

  return {
    artboard: { width, height },
    durationMs,
    fps,
    strategy: "single-layer-code-draft",
    cssDefaults: {
      startX: clampNumber(motionHints?.startX, 0, -320, 320),
      startY: clampNumber(motionHints?.startY, 0, -480, 480),
      startScale: shouldAnimateLayer ? 0.96 : 1,
      midScale: shouldAnimateLayer ? 1.03 : 1,
      endX: clampNumber(motionHints?.endX, 0, -320, 320),
      endY: clampNumber(motionHints?.endY, 0, -480, 480),
      opacity: 1,
      cornerRadius: 24,
      enterOpacity: shouldAnimateLayer ? 0 : 1
    },
    notes: [
      "首版工程化转换使用单图层代码动效草案。",
      "后续 worker 可用 ffmpeg 抽帧、多模态 LLM 识别和裁切图层替换该计划。"
    ]
  };
}

function createParams(): MotionParam[] {
  return [
    {
      id: "motionDuration",
      label: "动效时长",
      type: "duration",
      default: 1200,
      status: "confirmed",
      constraints: { min: 120, max: 5000, step: 20, unit: "ms" },
      targets: [
        { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }
      ]
    },
    {
      id: "startDelay",
      label: "开始延迟",
      type: "duration",
      default: 0,
      status: "confirmed",
      constraints: { min: 0, max: 2000, step: 20, unit: "ms" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--start-delay" }]
    },
    {
      id: "startX",
      label: "起点 X",
      type: "number",
      default: 0,
      status: "confirmed",
      constraints: { min: -320, max: 320, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--start-x" }]
    },
    {
      id: "startY",
      label: "起点 Y",
      type: "number",
      default: 68,
      status: "confirmed",
      constraints: { min: -480, max: 480, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--start-y" }]
    },
    {
      id: "midScale",
      label: "中段缩放",
      type: "range",
      default: 1.03,
      status: "confirmed",
      constraints: { min: 0.6, max: 1.6, step: 0.01 },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--mid-scale" }]
    },
    {
      id: "endX",
      label: "终点 X",
      type: "number",
      default: 0,
      status: "confirmed",
      constraints: { min: -320, max: 320, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--end-x" }]
    },
    {
      id: "endY",
      label: "终点 Y",
      type: "number",
      default: 0,
      status: "confirmed",
      constraints: { min: -480, max: 480, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--end-y" }]
    },
    {
      id: "layerOpacity",
      label: "图层透明度",
      type: "range",
      default: 1,
      status: "confirmed",
      constraints: { min: 0, max: 1, step: 0.01 },
      targets: [
        { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--layer-opacity" }
      ]
    },
    {
      id: "cornerRadius",
      label: "圆角",
      type: "number",
      default: 24,
      status: "confirmed",
      constraints: { min: 0, max: 80, step: 1, unit: "px" },
      targets: [
        { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--corner-radius" }
      ]
    },
    {
      id: "posterImage",
      label: "画面图层",
      type: "image",
      default: "",
      status: "confirmed",
      constraints: { allowedFileTypes: ["image/png", "image/jpeg", "image/webp"] },
      targets: [
        { kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--video-poster" }
      ]
    }
  ];
}

function createSourceFiles(input: CreateVideoMotionComponentDraftInput, plan: MotionPlan): SourceFile[] {
  const videoName = toCssString(input.video.fileName);
  const poster = toCssString(input.video.posterDataUrl ?? "");
  const frames = normalizedFrames(input.video);
  const timedFrames = frameTimings(frames, plan.durationMs);
  const frameLayers = frames
    .map(
      (_frame, index) =>
        `    <div class="motion-frame motion-frame-${index}" style="--frame-image: var(--frame-${index});"></div>`
    )
    .join("\n");

  const indexHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="./assets.css" />
    <link rel="stylesheet" href="./style.css" />
    <title>${input.name}</title>
  </head>
  <body>
<main class="motion-artboard" aria-label="${input.name}">
  <div class="motion-stage">
    <div class="motion-layer" role="img" aria-label="${videoName} generated motion layer">
${frameLayers || '      <div class="motion-frame fallback-frame" style="--frame-index: 0; --frame-image: var(--video-poster);"></div>'}
    </div>
  </div>
</main>
    <script src="./script.js"></script>
  </body>
</html>`;

  const styleCss = `:root {
  --artboard-width: ${plan.artboard.width}px;
  --artboard-height: ${plan.artboard.height}px;
  --motion-duration: ${plan.durationMs}ms;
  --start-delay: 0ms;
  --motion-easing: cubic-bezier(0.2, 0.8, 0.2, 1);
  --start-x: ${plan.cssDefaults.startX}px;
  --start-y: ${plan.cssDefaults.startY}px;
  --start-scale: ${plan.cssDefaults.startScale};
  --mid-scale: ${plan.cssDefaults.midScale};
  --end-x: ${plan.cssDefaults.endX}px;
  --end-y: ${plan.cssDefaults.endY}px;
  --layer-opacity: ${plan.cssDefaults.opacity};
  --enter-opacity: ${plan.cssDefaults.enterOpacity};
  --corner-radius: ${plan.cssDefaults.cornerRadius}px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #f5f5f4;
}

.motion-artboard {
  width: var(--artboard-width);
  height: var(--artboard-height);
  overflow: hidden;
  display: grid;
  place-items: center;
  background: #111111;
}

.motion-stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
}

.motion-layer {
  position: absolute;
  inset: 0;
  border-radius: var(--corner-radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0)),
    linear-gradient(135deg, #1d1d1f, #3a3a38);
  opacity: var(--layer-opacity);
  animation: generated-motion var(--motion-duration) var(--motion-easing) var(--start-delay) infinite both;
  transform-origin: 50% 50%;
  overflow: hidden;
}

.motion-frame {
  position: absolute;
  inset: 0;
  background: var(--frame-image) center / cover no-repeat;
  opacity: 0;
  animation-duration: var(--motion-duration);
  animation-timing-function: linear;
  animation-delay: var(--start-delay);
  animation-iteration-count: infinite;
  animation-fill-mode: both;
}

${timedFrames.map((_frame, index) => `.motion-frame-${index} { animation-name: frame-${index}; }`).join("\n")}

.fallback-frame {
  opacity: 1;
}

@keyframes generated-motion {
  0% {
    transform: translate3d(var(--start-x), var(--start-y), 0) scale(var(--start-scale));
    opacity: var(--enter-opacity);
  }

  52% {
    transform: translate3d(calc(var(--end-x) * 0.4), calc(var(--end-y) * 0.4), 0) scale(var(--mid-scale));
    opacity: var(--layer-opacity);
  }

  100% {
    transform: translate3d(var(--end-x), var(--end-y), 0) scale(1);
    opacity: var(--layer-opacity);
  }
}

${frameKeyframes(timedFrames)}`;

  const scriptJs = `document.documentElement.dataset.motionComponent = "${input.id}";`;
  const frameVariables = frames
    .map((frame, index) => `  --frame-${index}: url("${toCssString(frame.dataUrl)}");`)
    .join("\n");
  const assetsCss = `:root {
  --video-source-name: "${videoName}";
  --video-poster: ${poster ? `url("${poster}")` : "linear-gradient(135deg, #1d1d1f, #3a3a38)"};
${frameVariables}
}`;

  return [
    { path: "source/index.html", content: indexHtml, kind: "html" },
    { path: "source/style.css", content: styleCss, kind: "css" },
    { path: "source/script.js", content: scriptJs, kind: "js" },
    { path: "source/assets.css", content: assetsCss, kind: "css" }
  ];
}

function createManifest(input: CreateVideoMotionComponentDraftInput, params: MotionParam[]): MotionManifest {
  return {
    version: "1.0",
    id: `${input.id}-manifest`,
    name: input.name,
    sourceKind: "html-package",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    params,
    groups: [
      {
        id: "motion",
        label: "动效",
        params: ["motionDuration", "startDelay", "startX", "startY", "midScale", "endX", "endY"]
      },
      { id: "appearance", label: "外观", params: ["layerOpacity", "cornerRadius", "posterImage"] }
    ],
    capabilities: ["imported", "editable", "export-html"]
  };
}

function verifyComponent(component: MotionComponent): VerificationCheck[] {
  const index = component.source.files.find((file) => file.path === "source/index.html")?.content ?? "";
  const style = component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";

  return [
    {
      id: "entry-html",
      label: "入口 HTML",
      status: index.includes("motion-artboard") ? "pass" : "fail",
      message: "生成组件包含可预览入口"
    },
    {
      id: "no-video-wrapper",
      label: "非视频包装",
      status: /<video\b/i.test(index) ? "fail" : "pass",
      message: "生成结果不依赖原始 video 标签播放"
    },
    {
      id: "editable-vars",
      label: "可调变量",
      status: style.includes("--motion-duration") && style.includes("--start-x") ? "pass" : "fail",
      message: "CSS 暴露动效调节变量"
    }
  ];
}

export function createVideoMotionComponentDraft(
  input: CreateVideoMotionComponentDraftInput
): VideoMotionComponentDraft {
  const plan = createPlan(input.video);
  const params = createParams().map((param) => {
    if (param.id === "motionDuration") return { ...param, default: plan.durationMs };
    if (param.id === "startX") return { ...param, default: plan.cssDefaults.startX };
    if (param.id === "startY") return { ...param, default: plan.cssDefaults.startY };
    if (param.id === "endX") return { ...param, default: plan.cssDefaults.endX };
    if (param.id === "endY") return { ...param, default: plan.cssDefaults.endY };
    if (param.id === "posterImage") return { ...param, default: input.video.posterDataUrl ?? "" };
    return param;
  });
  const manifest = createManifest(input, params);
  const sourceFiles = createSourceFiles(input, plan);
  const component: MotionComponent = {
    id: input.id,
    name: input.name,
    category: "media",
    tags: ["uploaded", "video-generated", "motion"],
    useCases: ["video-to-motion"],
    moods: ["generated"],
    source: {
      id: input.id,
      origin: "generated",
      kind: "html-package",
      files: sourceFiles,
      entry: "source/index.html"
    },
    manifest
  };
  const checks = verifyComponent(component);

  return {
    job: createJob(input.id),
    plan,
    component,
    report: { checks }
  };
}

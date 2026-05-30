import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile as nodeReadFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";

type VideoUploadAnalysisInput = {
  fileName: string;
  dataUrl: string;
  execFile?: (command: string, args: string[]) => Promise<string>;
  readFile?: (path: string) => Promise<Buffer>;
};

export type VideoMotionDirection = "none" | "left" | "right" | "up" | "down";

export type VideoMotionHints = {
  direction: VideoMotionDirection;
  confidence: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type VideoUploadAnalysis = {
  width: number;
  height: number;
  durationMs: number;
  fps: number;
  posterDataUrl: string;
  frames: Array<{
    id: string;
    timestampMs: number;
    dataUrl: string;
  }>;
  contactSheetDataUrl: string;
  motionHints: VideoMotionHints;
};

type FrameCenter = {
  id: string;
  timestampMs: number;
  centerX: number;
  centerY: number;
};

type EstimateMotionHintsInput = {
  width: number;
  height: number;
  frames: FrameCenter[];
};

type MeasureRgbFrameCenterInput = {
  id: string;
  timestampMs: number;
  width: number;
  height: number;
  rgb: Buffer;
};

type VideoMetadata = {
  width: number;
  height: number;
  durationMs: number;
  fps: number;
};

type FfprobePayload = {
  streams?: Array<{
    codec_type?: unknown;
    width?: unknown;
    height?: unknown;
    r_frame_rate?: unknown;
    avg_frame_rate?: unknown;
  }>;
  format?: {
    format_name?: unknown;
    duration?: unknown;
  };
};

type PacketTimingPayload = {
  packets?: Array<{
    pts_time?: unknown;
    duration_time?: unknown;
  }>;
};

const execFile = promisify(execFileCallback);

function safeExtension(fileName: string): string {
  const extension = extname(fileName).toLowerCase();
  if (/^\.[a-z0-9]+$/.test(extension)) return extension;
  return ".mp4";
}

function parsePositiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseFrameRate(value: unknown): number {
  if (typeof value !== "string" || value === "0/0") return 30;
  const [numeratorRaw, denominatorRaw] = value.split("/");
  const numerator = Number.parseFloat(numeratorRaw ?? "");
  const denominator = Number.parseFloat(denominatorRaw ?? "");
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 30;
  return Math.round((numerator / denominator) * 100) / 100;
}

function emptyMotionHints(): VideoMotionHints {
  return {
    direction: "none",
    confidence: 0,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0
  };
}

function dominantDirection(dx: number, dy: number): VideoMotionDirection {
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return "none";
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "down" : "up";
}

export function estimateMotionHints(input: EstimateMotionHintsInput): VideoMotionHints {
  const first = input.frames[0];
  const last = input.frames.at(-1);
  if (!first || !last) return emptyMotionHints();

  const dx = last.centerX - first.centerX;
  const dy = last.centerY - first.centerY;
  const width = parsePositiveNumber(input.width, 1);
  const height = parsePositiveNumber(input.height, 1);

  return {
    direction: dominantDirection(dx, dy),
    confidence: Math.round(Math.max(Math.abs(dx) / width, Math.abs(dy) / height) * 100) / 100,
    startX: -Math.round(dx / 2),
    startY: -Math.round(dy / 2),
    endX: Math.round(dx / 2),
    endY: Math.round(dy / 2)
  };
}

export function measureRgbFrameCenter(input: MeasureRgbFrameCenterInput): FrameCenter | undefined {
  const expectedLength = input.width * input.height * 3;
  if (input.width <= 0 || input.height <= 0 || input.rgb.length < expectedLength) return undefined;

  let total = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (let pixelIndex = 0; pixelIndex < input.width * input.height; pixelIndex += 1) {
    const offset = pixelIndex * 3;
    const luminance =
      (input.rgb[offset] ?? 0) * 0.299 +
      (input.rgb[offset + 1] ?? 0) * 0.587 +
      (input.rgb[offset + 2] ?? 0) * 0.114;
    if (luminance <= 0) continue;

    const x = pixelIndex % input.width;
    const y = Math.floor(pixelIndex / input.width);
    total += luminance;
    weightedX += (x + 0.5) * luminance;
    weightedY += (y + 0.5) * luminance;
  }

  if (total <= 0) return undefined;
  return {
    id: input.id,
    timestampMs: input.timestampMs,
    centerX: weightedX / total,
    centerY: weightedY / total
  };
}

export function parseFfprobeMetadata(raw: string): VideoMetadata {
  const payload = JSON.parse(raw) as FfprobePayload;
  const videoStream = payload.streams?.find((stream) => stream.codec_type === "video");
  const fps = parseFrameRate(videoStream?.avg_frame_rate || videoStream?.r_frame_rate);

  return {
    width: Math.round(parsePositiveNumber(videoStream?.width, 390)),
    height: Math.round(parsePositiveNumber(videoStream?.height, 844)),
    durationMs: Math.round(parsePositiveNumber(payload.format?.duration, 1.2) * 1000),
    fps
  };
}

function hasFormatDuration(raw: string): boolean {
  const payload = JSON.parse(raw) as FfprobePayload;
  const duration = Number.parseFloat(String(payload.format?.duration ?? ""));
  return Number.isFinite(duration) && duration > 0;
}

export function parsePacketTiming(
  raw: string
): { durationMs: number; lastFrameTimestampMs: number } | undefined {
  const payload = JSON.parse(raw) as PacketTimingPayload;
  let endTime = 0;
  let lastFrameTimestamp = 0;

  for (const packet of payload.packets ?? []) {
    const startSeconds = parsePositiveNumber(packet.pts_time, 0);
    const durationSeconds = parsePositiveNumber(packet.duration_time, 0);
    endTime = Math.max(endTime, startSeconds + durationSeconds);
    lastFrameTimestamp = Math.max(lastFrameTimestamp, startSeconds);
  }

  return endTime > 0
    ? {
        durationMs: Math.round(endTime * 1000),
        lastFrameTimestampMs: Math.round(lastFrameTimestamp * 1000)
      }
    : undefined;
}

export function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (!match) {
    if (dataUrl.startsWith("data:")) throw new Error("Only base64 data URLs are supported");
    throw new Error("Invalid data URL");
  }

  return {
    mimeType: match[1] ?? "application/octet-stream",
    buffer: Buffer.from(match[2] ?? "", "base64")
  };
}

async function runExecFile(command: string, args: string[]): Promise<string> {
  const result = await execFile(command, args, { maxBuffer: 16 * 1024 * 1024 });
  return result.stdout;
}

export async function analyzeVideoUpload(input: VideoUploadAnalysisInput): Promise<VideoUploadAnalysis> {
  const parsed = parseDataUrl(input.dataUrl);
  const run = input.execFile ?? runExecFile;
  const readFile = input.readFile ?? nodeReadFile;
  const dir = await mkdtemp(join(tmpdir(), "ai-motion-video-"));
  const inputPath = join(dir, `input${safeExtension(input.fileName)}`);
  const frameSpecs = [
    { id: "start", ratio: 0 },
    { id: "middle", ratio: 0.5 },
    { id: "end", ratio: 1 }
  ];
  const contactSheetPath = join(dir, "contact-sheet.png");

  try {
    await writeFile(inputPath, parsed.buffer);
    const metadataRaw = await run("ffprobe", [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      inputPath
    ]);
    const metadata = parseFfprobeMetadata(metadataRaw);
    let lastFrameTimestampMs: number | undefined;
    if (!hasFormatDuration(metadataRaw)) {
      const packetRaw = await run("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_packets",
        "-show_entries",
        "packet=pts_time,duration_time",
        "-print_format",
        "json",
        inputPath
      ]);
      const packetTiming = parsePacketTiming(packetRaw);
      metadata.durationMs = packetTiming?.durationMs ?? metadata.durationMs;
      lastFrameTimestampMs = packetTiming?.lastFrameTimestampMs;
    }
    const lastTimestampMs = Math.max(
      0,
      lastFrameTimestampMs ?? metadata.durationMs - Math.round(1000 / Math.max(metadata.fps, 1))
    );
    const frames = [];
    const motionFrameCenters: FrameCenter[] = [];

    for (const spec of frameSpecs) {
      const timestampMs = Math.round(lastTimestampMs * spec.ratio);
      const outputPath = join(dir, `${spec.id}.png`);
      const motionPath = join(dir, `${spec.id}-motion.rgb`);

      await run("ffmpeg", [
        "-y",
        "-ss",
        String(timestampMs / 1000),
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-vf",
        "scale=iw:ih",
        outputPath
      ]);

      await run("ffmpeg", [
        "-y",
        "-ss",
        String(timestampMs / 1000),
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-vf",
        "scale=32:32",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        motionPath
      ]);

      frames.push({
        id: spec.id,
        timestampMs,
        dataUrl: `data:image/png;base64,${(await readFile(outputPath)).toString("base64")}`
      });

      const center = measureRgbFrameCenter({
        id: spec.id,
        timestampMs,
        width: 32,
        height: 32,
        rgb: await readFile(motionPath)
      });
      if (center) motionFrameCenters.push(center);
    }

    await run("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-vf",
      "fps=3,scale=160:-1,tile=3x1",
      "-frames:v",
      "1",
      contactSheetPath
    ]);

    return {
      ...metadata,
      posterDataUrl: frames[0]?.dataUrl ?? "",
      frames,
      contactSheetDataUrl: `data:image/png;base64,${(await readFile(contactSheetPath)).toString("base64")}`,
      motionHints: estimateMotionHints({
        width: 32,
        height: 32,
        frames: motionFrameCenters
      })
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

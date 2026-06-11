import { describe, expect, it } from "vitest";
import {
  analyzeVideoUpload,
  estimateMotionHints,
  measureRgbFrameCenter,
  parseDataUrl,
  parseFfprobeMetadata,
  parsePacketTiming
} from "./videoAnalyzer";

function rgbFrame(width: number, height: number, brightX: number, brightY: number): Buffer {
  const frame = Buffer.alloc(width * height * 3);
  const offset = (brightY * width + brightX) * 3;
  frame[offset] = 255;
  frame[offset + 1] = 255;
  frame[offset + 2] = 255;
  return frame;
}

describe("videoAnalyzer", () => {
  it("parses ffprobe metadata into motion input values", () => {
    const metadata = parseFfprobeMetadata(
      JSON.stringify({
        streams: [
          {
            codec_type: "video",
            width: 720,
            height: 1280,
            r_frame_rate: "30000/1001"
          }
        ],
        format: {
          duration: "1.25"
        }
      })
    );

    expect(metadata).toEqual({
      width: 720,
      height: 1280,
      durationMs: 1250,
      fps: 29.97
    });
  });

  it("decodes base64 data urls and rejects non-base64 uploads", () => {
    const parsed = parseDataUrl("data:video/mp4;base64,QUJD");

    expect(parsed.mimeType).toBe("video/mp4");
    expect(parsed.buffer.toString("utf8")).toBe("ABC");
    expect(() => parseDataUrl("data:video/mp4,ABC")).toThrow("Only base64 data URLs are supported");
  });

  it("parses packet timing when animated images omit format duration", () => {
    const timing = parsePacketTiming(
      JSON.stringify({
        packets: [
          { pts_time: "0.000000", duration_time: "0.480000" },
          { pts_time: "0.480000", duration_time: "0.040000" },
          { pts_time: "2.080000", duration_time: "1.400000" }
        ]
      })
    );

    expect(timing).toEqual({
      durationMs: 3480,
      lastFrameTimestampMs: 2080
    });
  });

  it("estimates horizontal motion from frame luminance centers", () => {
    const hints = estimateMotionHints({
      width: 100,
      height: 80,
      frames: [
        { id: "start", timestampMs: 0, centerX: 30, centerY: 40 },
        { id: "middle", timestampMs: 500, centerX: 48, centerY: 40 },
        { id: "end", timestampMs: 1000, centerX: 68, centerY: 42 }
      ]
    });

    expect(hints).toEqual({
      direction: "right",
      confidence: 0.38,
      startX: -19,
      startY: -1,
      endX: 19,
      endY: 1
    });
  });

  it("measures a luminance center from a tiny rgb frame", () => {
    const center = measureRgbFrameCenter({
      id: "start",
      timestampMs: 0,
      width: 4,
      height: 2,
      rgb: rgbFrame(4, 2, 2, 1)
    });

    expect(center?.centerX).toBeCloseTo(2.5);
    expect(center?.centerY).toBeCloseTo(1.5);
  });

  it("runs ffprobe and ffmpeg to return representative frames and a contact sheet", async () => {
    const calls: string[] = [];
    const outputFiles = new Map<string, Buffer>();
    const rawFrameById = new Map([
      ["start-motion.rgb", rgbFrame(32, 32, 8, 16)],
      ["middle-motion.rgb", rgbFrame(32, 32, 16, 16)],
      ["end-motion.rgb", rgbFrame(32, 32, 24, 16)]
    ]);

    const result = await analyzeVideoUpload({
      fileName: "demo.mp4",
      dataUrl: "data:video/mp4;base64,QUJD",
      execFile: async (command, args) => {
        calls.push(`${command} ${args.join(" ")}`);

        if (command === "ffprobe") {
          return JSON.stringify({
            streams: [{ codec_type: "video", width: 390, height: 844, r_frame_rate: "30/1" }],
            format: { duration: "1.2" }
          });
        }

        const outputPath = args.at(-1);
        if (!outputPath) throw new Error("missing output path");
        const rawFrame = [...rawFrameById.entries()].find(([name]) => outputPath.endsWith(name))?.[1];
        outputFiles.set(
          outputPath,
          rawFrame ?? Buffer.from(outputPath.includes("contact") ? "SHEET" : `PNG-${calls.length}`)
        );
        return "";
      },
      readFile: async (path) => outputFiles.get(path) ?? Buffer.from("")
    });

    expect(calls.some((call) => call.startsWith("ffprobe "))).toBe(true);
    expect(calls.some((call) => call.startsWith("ffmpeg "))).toBe(true);
    expect(result).toMatchObject({
      width: 390,
      height: 844,
      durationMs: 1200,
      fps: 30,
      contactSheetDataUrl: "data:image/png;base64,U0hFRVQ="
    });
    expect(result.motionHints?.direction).toBe("right");
    expect(result.motionHints?.startX).toBeLessThan(0);
    expect(result.motionHints?.endX).toBeGreaterThan(0);
    expect(result.posterDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.frames).toHaveLength(3);
    expect(result.frames.map((frame) => frame.id)).toEqual(["start", "middle", "end"]);
    expect(result.frames.map((frame) => frame.timestampMs)).toEqual([0, 584, 1167]);
    expect(result.frames.every((frame) => frame.dataUrl.startsWith("data:image/png;base64,"))).toBe(true);
    expect(calls.filter((call) => call.startsWith("ffmpeg "))).toHaveLength(7);
  });

  it("uses packet timing duration when ffprobe format duration is missing", async () => {
    const outputFiles = new Map<string, Buffer>();

    const result = await analyzeVideoUpload({
      fileName: "demo.png",
      dataUrl: "data:image/png;base64,QUJD",
      execFile: async (command, args) => {
        if (command === "ffprobe" && args.includes("-show_packets")) {
          return JSON.stringify({
            packets: [
              { pts_time: "0.000000", duration_time: "0.480000" },
              { pts_time: "0.480000", duration_time: "0.040000" },
              { pts_time: "2.080000", duration_time: "1.400000" }
            ]
          });
        }

        if (command === "ffprobe") {
          return JSON.stringify({
            streams: [{ codec_type: "video", width: 1545, height: 2868, r_frame_rate: "25/1" }],
            format: { format_name: "apng" }
          });
        }

        const outputPath = args.at(-1);
        if (!outputPath) throw new Error("missing output path");
        outputFiles.set(
          outputPath,
          outputPath.endsWith(".rgb") ? rgbFrame(32, 32, 16, 16) : Buffer.from("PNG")
        );
        return "";
      },
      readFile: async (path) => outputFiles.get(path) ?? Buffer.from("")
    });

    expect(result.durationMs).toBe(3480);
    expect(result.frames.map((frame) => frame.timestampMs)).toEqual([0, 1040, 2080]);
  });
});

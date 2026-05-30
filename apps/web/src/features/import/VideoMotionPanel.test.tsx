import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeVideoOnServer, inspectUpload, VideoMotionPanel } from "./VideoMotionPanel";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VideoMotionPanel", () => {
  it("renders the video-to-motion upload entry", () => {
    const html = renderToStaticMarkup(<VideoMotionPanel onComponentReady={vi.fn()} />);

    expect(html).toContain("视频转动效");
    expect(html).toContain("上传视频生成代码组件");
    expect(html).toContain("选择视频");
    expect(html).toContain("video/mp4");
  });

  it("sends video files to the server analyzer", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          width: 390,
          height: 844,
          durationMs: 1200,
          fps: 30,
          posterDataUrl: "data:image/png;base64,POSTER",
          frames: [
            { id: "start", timestampMs: 0, dataUrl: "data:image/png;base64,START" },
            { id: "middle", timestampMs: 584, dataUrl: "data:image/png;base64,MIDDLE" },
            { id: "end", timestampMs: 1167, dataUrl: "data:image/png;base64,END" }
          ],
          contactSheetDataUrl: "data:image/png;base64,SHEET",
          motionHints: {
            direction: "right",
            confidence: 0.24,
            startX: -12,
            startY: 0,
            endX: 12,
            endY: 0
          }
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["demo"], "demo.mp4", { type: "video/mp4" });
    const result = await analyzeVideoOnServer(file, "data:video/mp4;base64,AAAA");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/video/analyze",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
    );
    expect(result.posterDataUrl).toBe("data:image/png;base64,POSTER");
    expect(result.fps).toBe(30);
    expect(result.frames).toHaveLength(3);
    expect(result.contactSheetDataUrl).toBe("data:image/png;base64,SHEET");
    expect(result.motionHints?.startX).toBe(-12);
  });

  it("sends png uploads through server analysis so APNG files keep their frames", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          width: 1545,
          height: 2868,
          durationMs: 480,
          fps: 25,
          posterDataUrl: "data:image/png;base64,POSTER",
          frames: [
            { id: "start", timestampMs: 0, dataUrl: "data:image/png;base64,START" },
            { id: "end", timestampMs: 440, dataUrl: "data:image/png;base64,END" }
          ],
          contactSheetDataUrl: "data:image/png;base64,SHEET",
          motionHints: {
            direction: "left",
            confidence: 0.2,
            startX: 16,
            startY: 0,
            endX: -16,
            endY: 0
          }
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["apng"], "横向切换.png", { type: "image/png" });
    const result = await inspectUpload(file, "data:image/png;base64,AAAA");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.frames).toHaveLength(2);
    expect(result.durationMs).toBe(480);
    expect(result.motionHints?.direction).toBe("left");
  });
});

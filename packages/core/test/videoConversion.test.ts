import { describe, expect, it } from "vitest";
import { createVideoMotionComponentDraft } from "../src/video/createVideoMotionComponentDraft";

describe("createVideoMotionComponentDraft", () => {
  it("creates an editable code component draft from uploaded video metadata", () => {
    const result = createVideoMotionComponentDraft({
      id: "uploaded-demo",
      name: "上传视频动效",
      video: {
        fileName: "demo.mp4",
        mimeType: "video/mp4",
        dataUrl: "data:video/mp4;base64,AAAA",
        posterDataUrl: "data:image/png;base64,POSTER",
        frames: [
          { id: "start", timestampMs: 0, dataUrl: "data:image/png;base64,START" },
          { id: "middle", timestampMs: 600, dataUrl: "data:image/png;base64,MIDDLE" },
          { id: "end", timestampMs: 1200, dataUrl: "data:image/png;base64,END" }
        ],
        motionHints: {
          direction: "right",
          confidence: 0.42,
          startX: -42,
          startY: 0,
          endX: 42,
          endY: 0
        },
        width: 390,
        height: 844,
        durationMs: 1200,
        fps: 30
      }
    });

    expect(result.job.status).toBe("completed");
    expect(result.component.source.files.map((file) => file.path)).toEqual([
      "source/index.html",
      "source/style.css",
      "source/script.js",
      "source/assets.css"
    ]);
    const index =
      result.component.source.files.find((file) => file.path === "source/index.html")?.content ?? "";
    expect(index).not.toContain("<video");
    expect(index).toContain('href="./assets.css"');
    expect(index).toContain('href="./style.css"');
    expect(index).toContain('src="./script.js"');
    expect(result.component.source.files.find((file) => file.path === "source/style.css")?.content).toContain(
      "--motion-duration: 1200ms"
    );
    expect(result.component.manifest.params.map((param) => param.id)).toEqual([
      "motionDuration",
      "startDelay",
      "startX",
      "startY",
      "midScale",
      "endX",
      "endY",
      "layerOpacity",
      "cornerRadius",
      "posterImage"
    ]);
    const assets =
      result.component.source.files.find((file) => file.path === "source/assets.css")?.content ?? "";
    expect(assets).toContain("data:image/png;base64,POSTER");
    expect(assets).toContain("--frame-0");
    expect(assets).toContain("--frame-1");
    expect(assets).toContain("--frame-2");
    expect(assets).toContain("data:image/png;base64,START");
    expect(assets).toContain("data:image/png;base64,MIDDLE");
    expect(assets).toContain("data:image/png;base64,END");
    expect(assets).not.toContain("data:video/mp4");
    const style =
      result.component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";
    expect(style).toContain("@keyframes frame-0");
    expect(style).toContain("@keyframes frame-1");
    expect(style).toContain("@keyframes frame-2");
    expect(style).toContain(".motion-frame-0 { animation-name: frame-0; }");
    expect(style).toContain("--start-x: -42px");
    expect(style).toContain("--end-x: 42px");
    expect(result.component.manifest.params.every((param) => param.status === "confirmed")).toBe(true);
    expect(result.component.manifest.capabilities).toContain("editable");
    expect(result.report.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("does not add fake movement when no motion hints are available", () => {
    const result = createVideoMotionComponentDraft({
      id: "apng-demo",
      name: "APNG 动效",
      video: {
        fileName: "demo.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AAAA",
        posterDataUrl: "data:image/png;base64,POSTER",
        frames: [
          { id: "start", timestampMs: 0, dataUrl: "data:image/png;base64,START" },
          { id: "middle", timestampMs: 1040, dataUrl: "data:image/png;base64,MIDDLE" },
          { id: "end", timestampMs: 2080, dataUrl: "data:image/png;base64,END" }
        ],
        width: 1545,
        height: 2868,
        durationMs: 3480,
        fps: 25
      }
    });
    const style =
      result.component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";

    expect(style).toContain("--motion-duration: 3480ms");
    expect(style).toContain("--start-x: 0px");
    expect(style).toContain("--start-y: 0px");
    expect(style).toContain("--start-scale: 1");
    expect(style).toContain("--mid-scale: 1");
    expect(style).toContain("--end-x: 0px");
    expect(style).toContain("--end-y: 0px");
    expect(style).toContain("0% { opacity: 1; }");
    expect(style).toContain("29.89% { opacity: 1; }");
    expect(style).toContain("59.77% { opacity: 1; }");
  });
});

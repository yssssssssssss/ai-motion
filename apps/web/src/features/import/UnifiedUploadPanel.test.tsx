import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { classifyUploadFiles, SUPPORTED_UPLOAD_ACCEPT, UnifiedUploadPanel } from "./UnifiedUploadPanel";

describe("classifyUploadFiles", () => {
  it("routes one motion media file to the video conversion pipeline", () => {
    expect(classifyUploadFiles([new File(["demo"], "demo.mp4", { type: "video/mp4" })])).toBe("video");
    expect(classifyUploadFiles([new File(["demo"], "demo.gif", { type: "image/gif" })])).toBe("video");
    expect(classifyUploadFiles([new File(["demo"], "demo.png", { type: "image/png" })])).toBe("video");
  });

  it("routes source files and packages to the source import pipeline", () => {
    expect(classifyUploadFiles([new File(["<html></html>"], "index.html", { type: "text/html" })])).toBe(
      "source"
    );
    expect(classifyUploadFiles([new File(["demo"], "component.zip", { type: "application/zip" })])).toBe(
      "source"
    );
    expect(
      classifyUploadFiles([
        new File(["<html></html>"], "index.html", { type: "text/html" }),
        new File(["body{}"], "style.css", { type: "text/css" })
      ])
    ).toBe("source");
  });
});

describe("UnifiedUploadPanel", () => {
  it("renders one upload entry for media and source components", () => {
    const html = renderToStaticMarkup(
      <UnifiedUploadPanel onImportFiles={() => undefined} onVideoComponentReady={() => undefined} />
    );

    expect(html).toContain("拖拽或选择动效文件");
    expect(html).toContain("MP4 / MOV / WebM / GIF / PNG / HTML / CSS / JS / JSON / SVG / ZIP");
    expect(html).toContain(SUPPORTED_UPLOAD_ACCEPT);
    expect(html).toContain("选择文件");
    expect(html).not.toContain("上传视频生成代码组件");
    expect(html).not.toContain("视频转动效");
  });
});

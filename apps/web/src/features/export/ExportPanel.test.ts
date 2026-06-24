import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ExportPanel", () => {
  it("exposes an embed package export without changing the existing export actions", () => {
    const source = readFileSync(resolve(__dirname, "ExportPanel.tsx"), "utf8");

    expect(source).toContain("composeStandaloneHtmlFile");
    expect(source).toContain("composeEditablePackageFiles");
    expect(source).toContain("composeEmbedPackageFiles");
    expect(source).toContain("导出 HTML");
    expect(source).toContain("导出 ZIP 工程");
    expect(source).toContain("导出嵌入包");
    expect(source).toContain("link.download = `${project.id}-embed.zip`");
  });
});

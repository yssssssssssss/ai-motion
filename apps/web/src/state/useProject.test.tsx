// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { MotionManifest, MotionSource } from "@motion-tool/core";
import { useProject } from "./useProject";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

it("restores only current params, rebases manifest identity and resets to the saved baseline", async () => {
  const source: MotionSource = {
    id: "source",
    kind: "single-html",
    origin: "imported",
    entry: "index.html",
    files: []
  };
  const manifest: MotionManifest = {
    version: "1.0",
    id: "current",
    name: "当前",
    sourceKind: "single-html",
    runtime: { engine: "html", entry: "index.html", sandbox: "iframe" },
    params: [{ id: "title", label: "标题", type: "text", default: "saved", status: "confirmed", targets: [] }]
  };
  let state: ReturnType<typeof useProject>;
  function Harness() {
    state = useProject();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Harness />));
  try {
    await act(async () =>
      state.startProject(source, manifest, {
        id: "draft",
        sourceManifestId: "old",
        values: { title: "edited", removed: "stale" }
      })
    );
    expect(state!.project?.patch).toMatchObject({ sourceManifestId: "current", values: { title: "edited" } });
    await act(async () => state.resetParams());
    expect(state!.project?.patch.values).toEqual({});
    expect(state!.project?.manifest.params[0]?.default).toBe("saved");
  } finally {
    await act(async () => root.unmount());
  }
});

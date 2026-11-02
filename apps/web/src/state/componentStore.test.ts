import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, it, vi } from "vitest";
import type { MotionComponent, MotionPatch } from "@motion-tool/core";
import { createComponentStore } from "./componentStore";

const component: MotionComponent = {
  id: "upload",
  name: "上传",
  category: "layout",
  tags: [],
  useCases: [],
  moods: [],
  source: {
    id: "different-source-id",
    origin: "imported",
    kind: "single-html",
    entry: "index.html",
    files: [{ path: "index.html", kind: "html", content: "<main>uploaded</main>" }]
  },
  manifest: {
    version: "1.0",
    id: "upload-manifest",
    name: "上传",
    sourceKind: "single-html",
    runtime: { engine: "html", entry: "index.html", sandbox: "iframe" },
    params: []
  }
};
const patch: MotionPatch = { id: "patch", sourceManifestId: "old", values: { title: "edited" } };

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
});

it("round-trips imported components and drafts through a fresh store handle", async () => {
  const store = createComponentStore();
  await store.saveComponent(component);
  await store.saveDraft(component.id, patch);
  expect(await createComponentStore().load()).toEqual({
    components: [component],
    drafts: { upload: patch }
  });
});

it("deletes both a component and its draft", async () => {
  const store = createComponentStore();
  await store.saveComponent(component);
  await store.saveDraft(component.id, patch);
  await store.deleteComponent(component.id);
  expect(await createComponentStore().load()).toEqual({ components: [], drafts: {} });
});

it("an empty patch clears a draft without modifying its original component", async () => {
  const store = createComponentStore();
  await store.saveComponent(component);
  await store.saveDraft(component.id, patch);
  await store.saveDraft(component.id, { ...patch, values: {} });
  expect(await store.load()).toEqual({ components: [component], drafts: {} });
});

it("drops malformed records without losing valid components", async () => {
  const store = createComponentStore();
  await store.saveComponent(component);
  await store.saveComponent({ id: "broken", source: {} } as MotionComponent);
  expect(await store.load()).toEqual({ components: [component], drafts: {} });
});

it("opens lazily and reports unavailable or failed storage", async () => {
  vi.stubGlobal("indexedDB", undefined);
  const store = createComponentStore();
  await expect(store.load()).rejects.toThrow();
  vi.stubGlobal("indexedDB", {
    open: () => {
      throw new Error("storage failed");
    }
  });
  await expect(store.saveComponent(component)).rejects.toThrow("storage failed");
});

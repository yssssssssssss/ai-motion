import { useState, useCallback } from "react";
import type { MotionManifest, MotionPatch, MotionSource } from "@motion-tool/core";
import { createEmptyPatch, type MotionProject } from "./projectStore";

function createProject(source: MotionSource, manifest: MotionManifest): MotionProject {
  return {
    id: `${source.id}-project`,
    source,
    manifest,
    patch: createEmptyPatch(manifest)
  };
}

// 当前编辑中的项目状态：源码、manifest、用户改动 patch。
export function useProject() {
  const [project, setProject] = useState<MotionProject | null>(null);

  const startProject = useCallback((source: MotionSource, manifest: MotionManifest) => {
    setProject(createProject(source, manifest));
  }, []);

  const updateParam = useCallback((paramId: string, value: unknown) => {
    setProject((current) => {
      if (!current) return current;
      const nextValues: MotionPatch["values"] = { ...current.patch.values, [paramId]: value };
      return {
        ...current,
        patch: { ...current.patch, values: nextValues }
      };
    });
  }, []);

  // 重播：复制 project 引用以触发 PreviewFrame 重新渲染。
  const replay = useCallback(() => {
    setProject((current) => (current ? { ...current } : current));
  }, []);

  // 把所有参数清回 manifest.params 的 default
  const resetParams = useCallback(() => {
    setProject((current) => {
      if (!current) return current;
      return {
        ...current,
        patch: createEmptyPatch(current.manifest)
      };
    });
  }, []);

  return { project, startProject, updateParam, replay, resetParams };
}

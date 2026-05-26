import { useState, useCallback } from "react";
import {
  confirmValidParams,
  importMotionSourceFromFiles,
  scanSourceForParams,
  suggestParams,
  type MotionComponent,
  type MotionComponentMetadata,
  type MotionManifest,
  type MotionParam,
  type MotionSource
} from "@motion-tool/core";

// 导入流程分为三阶段：上传 → 确认参数 → 补充元数据
type ImportPhase = "idle" | "confirm-params" | "fill-metadata";

export function useImportFlow() {
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [pendingImport, setPendingImport] = useState<MotionSource | null>(null);
  const [importWarnings, setImportWarnings] = useState<import("@motion-tool/core").ImportWarning[]>([]);
  const [suggestedParams, setSuggestedParams] = useState<MotionParam[]>([]);
  const [selectedParamIds, setSelectedParamIds] = useState<Set<string>>(new Set());
  const [pendingManifest, setPendingManifest] = useState<MotionManifest | null>(null);

  // 阶段 1：上传文件 → 解析 → 自动扫描参数 → 进入确认参数阶段
  const importFiles = useCallback((files: Record<string, string>) => {
    const result = importMotionSourceFromFiles(files);
    const suggested = suggestParams(scanSourceForParams(result.source));
    setPendingImport(result.source);
    setImportWarnings(result.warnings);
    setSuggestedParams(suggested);
    setSelectedParamIds(new Set(suggested.map((param) => param.id)));
    setPhase("confirm-params");
  }, []);

  const toggleParam = useCallback((id: string) => {
    setSelectedParamIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 阶段 2：确认参数勾选 → 生成 manifest → 进入元数据阶段
  const confirmParams = useCallback(() => {
    if (!pendingImport) return;
    const selected = suggestedParams.filter((param) => selectedParamIds.has(param.id));
    const validation = confirmValidParams({ source: pendingImport, params: selected });
    const manifest: MotionManifest = {
      version: "1.0",
      id: `${pendingImport.id}-manifest`,
      name: "导入动效",
      sourceKind: pendingImport.kind,
      runtime: { engine: "html", entry: pendingImport.entry, sandbox: "iframe" },
      params: validation.confirmed,
      capabilities: ["imported", "editable", "export-html"]
    };
    setPendingManifest(manifest);
    setPhase("fill-metadata");
  }, [pendingImport, suggestedParams, selectedParamIds]);

  // 阶段 3：提交元数据 → 生成完整 MotionComponent，重置流程
  const submitMetadata = useCallback(
    (metadata: MotionComponentMetadata): MotionComponent | null => {
      if (!pendingImport || !pendingManifest) return null;

      const component: MotionComponent = {
        ...metadata,
        source: { ...pendingImport, id: metadata.id },
        manifest: { ...pendingManifest, id: `${metadata.id}-manifest`, name: metadata.name }
      };

      // 重置状态
      setPendingImport(null);
      setImportWarnings([]);
      setSuggestedParams([]);
      setSelectedParamIds(new Set());
      setPendingManifest(null);
      setPhase("idle");

      return component;
    },
    [pendingImport, pendingManifest]
  );

  // 取消导入流程
  const cancelImport = useCallback(() => {
    setPendingImport(null);
    setImportWarnings([]);
    setSuggestedParams([]);
    setSelectedParamIds(new Set());
    setPendingManifest(null);
    setPhase("idle");
  }, []);

  return {
    phase,
    pendingImport,
    importWarnings,
    suggestedParams,
    selectedParamIds,
    importFiles,
    toggleParam,
    confirmParams,
    submitMetadata,
    cancelImport
  };
}
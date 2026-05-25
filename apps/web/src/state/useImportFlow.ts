import { useState, useCallback } from "react";
import {
  confirmValidParams,
  importMotionSourceFromFiles,
  scanSourceForParams,
  suggestParams,
  type MotionManifest,
  type MotionParam,
  type MotionSource
} from "@motion-tool/core";

type ConfirmResult = { source: MotionSource; manifest: MotionManifest } | null;

// 导入用户提供的本地文件 → 扫描参数 → 用户勾选 → 生成可编辑项目。
// 该 hook 内部状态相互绑定，从 App.tsx 抽出独立维护以便测试与复用。
export function useImportFlow() {
  const [pendingImport, setPendingImport] = useState<MotionSource | null>(null);
  const [suggestedParams, setSuggestedParams] = useState<MotionParam[]>([]);
  const [selectedParamIds, setSelectedParamIds] = useState<Set<string>>(new Set());

  const importFiles = useCallback((files: Record<string, string>) => {
    const result = importMotionSourceFromFiles(files);
    const suggested = suggestParams(scanSourceForParams(result.source));
    setPendingImport(result.source);
    setSuggestedParams(suggested);
    setSelectedParamIds(new Set(suggested.map((param) => param.id)));
  }, []);

  const toggleParam = useCallback((id: string) => {
    setSelectedParamIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 确认勾选后构造 manifest；返回 null 表示当前没有待确认的导入。
  const confirmImport = useCallback((): ConfirmResult => {
    if (!pendingImport) return null;
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
    return { source: pendingImport, manifest };
  }, [pendingImport, suggestedParams, selectedParamIds]);

  return {
    suggestedParams,
    selectedParamIds,
    importFiles,
    toggleParam,
    confirmImport
  };
}

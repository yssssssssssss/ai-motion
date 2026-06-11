import { useState, useCallback } from "react";
import {
  confirmValidParams,
  importMotionSourceFromFiles,
  scanSourceForLayers,
  scanSourceForParams,
  suggestParams,
  type MotionComponent,
  type MotionLayer,
  type MotionComponentMetadata,
  type MotionManifest,
  type MotionParam,
  type MotionSource
} from "@motion-tool/core";

// 导入流程分为四阶段：上传 → 确认参数 → 确认图层 → 补充元数据
type ImportPhase = "idle" | "confirm-params" | "confirm-layers" | "fill-metadata";

export const DEFAULT_IMPORT_DESIGN_SPEC_ID = "campaign-motion-skill";

export function applyLayerSelection(
  manifest: MotionManifest,
  selectedReplaceableLayerIds: Set<string>
): MotionManifest {
  return {
    ...manifest,
    layers: (manifest.layers ?? []).map((layer) => ({
      ...layer,
      replaceable: selectedReplaceableLayerIds.has(layer.id)
    }))
  };
}

export function applyDesignSpecSelection(
  manifest: MotionManifest,
  designSpecId: string | null
): MotionManifest {
  if (!designSpecId) return { ...manifest, designSpecs: [] };
  return { ...manifest, designSpecs: [{ id: designSpecId, confidence: 1, required: true }] };
}

type DraftImportState = {
  pendingImport: MotionSource;
  pendingManifest: MotionManifest;
  importWarnings: import("@motion-tool/core").ImportWarning[];
  suggestedParams: MotionParam[];
  selectedParamIds: Set<string>;
  suggestedLayers: MotionLayer[];
  selectedReplaceableLayerIds: Set<string>;
  selectedDesignSpecId: string | null;
  metadataDefaults: MotionComponentMetadata;
};

export function createDraftImportState(component: MotionComponent): DraftImportState {
  const suggestedParams =
    component.manifest.params.length > 0
      ? component.manifest.params
      : suggestParams(scanSourceForParams(component.source));
  const suggestedLayers =
    component.manifest.layers && component.manifest.layers.length > 0
      ? component.manifest.layers
      : scanSourceForLayers(component.source);

  return {
    pendingImport: component.source,
    pendingManifest: component.manifest,
    importWarnings: [],
    suggestedParams,
    selectedParamIds: new Set(suggestedParams.map((param) => param.id)),
    suggestedLayers,
    selectedReplaceableLayerIds: new Set(
      suggestedLayers.filter((layer) => layer.replaceable).map((layer) => layer.id)
    ),
    selectedDesignSpecId: DEFAULT_IMPORT_DESIGN_SPEC_ID,
    metadataDefaults: {
      id: component.id,
      name: component.name,
      category: component.category,
      tags: component.tags,
      useCases: component.useCases,
      moods: component.moods
    }
  };
}

export function useImportFlow() {
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [pendingImport, setPendingImport] = useState<MotionSource | null>(null);
  const [importWarnings, setImportWarnings] = useState<import("@motion-tool/core").ImportWarning[]>([]);
  const [suggestedParams, setSuggestedParams] = useState<MotionParam[]>([]);
  const [selectedParamIds, setSelectedParamIds] = useState<Set<string>>(new Set());
  const [suggestedLayers, setSuggestedLayers] = useState<MotionLayer[]>([]);
  const [selectedReplaceableLayerIds, setSelectedReplaceableLayerIds] = useState<Set<string>>(new Set());
  const [selectedDesignSpecId, setSelectedDesignSpecId] = useState<string | null>(
    DEFAULT_IMPORT_DESIGN_SPEC_ID
  );
  const [pendingManifest, setPendingManifest] = useState<MotionManifest | null>(null);
  const [metadataDefaults, setMetadataDefaults] = useState<MotionComponentMetadata | null>(null);

  // 阶段 1：上传文件 → 解析 → 自动扫描参数 → 进入确认参数阶段
  const importFiles = useCallback((files: Record<string, string>) => {
    const result = importMotionSourceFromFiles(files);
    const suggested = suggestParams(scanSourceForParams(result.source));
    const layers = scanSourceForLayers(result.source);
    setPendingImport(result.source);
    setImportWarnings(result.warnings);
    setSuggestedParams(suggested);
    setSelectedParamIds(new Set(suggested.map((param) => param.id)));
    setSuggestedLayers(layers);
    setSelectedReplaceableLayerIds(
      new Set(layers.filter((layer) => layer.replaceable).map((layer) => layer.id))
    );
    setSelectedDesignSpecId(DEFAULT_IMPORT_DESIGN_SPEC_ID);
    setPendingManifest(null);
    setMetadataDefaults(null);
    setPhase("confirm-params");
  }, []);

  const importComponentDraft = useCallback((component: MotionComponent) => {
    const draft = createDraftImportState(component);
    setPendingImport(draft.pendingImport);
    setPendingManifest(draft.pendingManifest);
    setImportWarnings(draft.importWarnings);
    setSuggestedParams(draft.suggestedParams);
    setSelectedParamIds(draft.selectedParamIds);
    setSuggestedLayers(draft.suggestedLayers);
    setSelectedReplaceableLayerIds(draft.selectedReplaceableLayerIds);
    setSelectedDesignSpecId(draft.selectedDesignSpecId);
    setMetadataDefaults(draft.metadataDefaults);
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

  const toggleLayer = useCallback((id: string) => {
    setSelectedReplaceableLayerIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 阶段 2：确认参数勾选 → 生成 manifest → 进入图层阶段
  const confirmParams = useCallback(() => {
    if (!pendingImport) return;
    const selected = suggestedParams.filter((param) => selectedParamIds.has(param.id));
    const validation = confirmValidParams({ source: pendingImport, params: selected });
    const manifest: MotionManifest = pendingManifest
      ? {
          ...pendingManifest,
          sourceKind: pendingImport.kind,
          runtime: { ...pendingManifest.runtime, entry: pendingImport.entry },
          params: validation.confirmed,
          layers: suggestedLayers,
          capabilities: pendingManifest.capabilities ?? ["imported", "editable", "export-html"]
        }
      : {
          version: "1.0",
          id: `${pendingImport.id}-manifest`,
          name: "导入动效",
          sourceKind: pendingImport.kind,
          runtime: { engine: "html", entry: pendingImport.entry, sandbox: "iframe" },
          params: validation.confirmed,
          layers: suggestedLayers,
          capabilities: ["imported", "editable", "export-html"]
        };
    setPendingManifest(manifest);
    setPhase("confirm-layers");
  }, [pendingImport, pendingManifest, suggestedLayers, suggestedParams, selectedParamIds]);

  const confirmLayers = useCallback(() => {
    setPendingManifest((manifest) => {
      if (!manifest) return manifest;
      return applyDesignSpecSelection(
        applyLayerSelection(manifest, selectedReplaceableLayerIds),
        selectedDesignSpecId
      );
    });
    setPhase("fill-metadata");
  }, [selectedDesignSpecId, selectedReplaceableLayerIds]);

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
      setSuggestedLayers([]);
      setSelectedReplaceableLayerIds(new Set());
      setSelectedDesignSpecId(DEFAULT_IMPORT_DESIGN_SPEC_ID);
      setPendingManifest(null);
      setMetadataDefaults(null);
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
    setSuggestedLayers([]);
    setSelectedReplaceableLayerIds(new Set());
    setSelectedDesignSpecId(DEFAULT_IMPORT_DESIGN_SPEC_ID);
    setPendingManifest(null);
    setMetadataDefaults(null);
    setPhase("idle");
  }, []);

  return {
    phase,
    pendingImport,
    importWarnings,
    suggestedParams,
    selectedParamIds,
    suggestedLayers,
    selectedReplaceableLayerIds,
    selectedDesignSpecId,
    metadataDefaults,
    importFiles,
    importComponentDraft,
    toggleParam,
    toggleLayer,
    setSelectedDesignSpecId,
    confirmParams,
    confirmLayers,
    submitMetadata,
    cancelImport
  };
}

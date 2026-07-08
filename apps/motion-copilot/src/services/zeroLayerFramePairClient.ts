import type { ZeroLayerFramePairDiscovery } from "@motion-copilot/core";

export type ZeroLayerFramePairDiscoveryResult = {
  discovery: ZeroLayerFramePairDiscovery;
  source: "real-zero-mcp-http" | "zero-layer-bridge" | "custom-command" | "unknown";
  bridge?: string;
};

type ZeroLayerFramePairResponse = {
  discovery?: unknown;
  error?: unknown;
  source?: unknown;
  bridge?: unknown;
};

function normalizeSource(value: unknown): ZeroLayerFramePairDiscoveryResult["source"] {
  if (value === "real-zero-mcp-http" || value === "zero-layer-bridge" || value === "custom-command")
    return value;
  return "unknown";
}

function normalizeDiscovery(value: unknown): ZeroLayerFramePairDiscovery {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Zero frame pair discovery response is invalid.");
  }
  const discovery = value as ZeroLayerFramePairDiscovery;
  if (discovery.schemaVersion !== "motion-copilot.zero-layer-frame-pair-discovery.v1") {
    throw new Error("Zero frame pair discovery schemaVersion is invalid.");
  }
  if (
    !Array.isArray(discovery.pages) ||
    !Array.isArray(discovery.candidates) ||
    !Array.isArray(discovery.pairs)
  ) {
    throw new Error("Zero frame pair discovery response is incomplete.");
  }
  return discovery;
}

export async function fetchZeroLayerFramePairDiscovery(): Promise<ZeroLayerFramePairDiscoveryResult> {
  const response = await fetch("/api/zero/layer-frame-pairs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  const payload = (await response.json()) as ZeroLayerFramePairResponse;
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : `Zero frame pair discovery failed: ${response.status}`
    );
  }
  return {
    discovery: normalizeDiscovery(payload.discovery),
    source: normalizeSource(payload.source),
    ...(typeof payload.bridge === "string" ? { bridge: payload.bridge } : {})
  };
}

import { normalizeZeroLayerSnapshot, type ZeroLayerSnapshot } from "@motion-copilot/core";

export type ZeroLayerSnapshotSource = "real-zero-mcp-http" | "fixture" | "zero-layer-bridge" | "custom-command" | "unknown";

export type ZeroLayerSnapshotResult = {
  snapshot: ZeroLayerSnapshot;
  source: ZeroLayerSnapshotSource;
  bridge?: string;
};

type ZeroLayerSnapshotResponse = {
  snapshot?: unknown;
  error?: unknown;
  source?: unknown;
  bridge?: unknown;
};

function normalizeSource(value: unknown): ZeroLayerSnapshotSource {
  if (
    value === "real-zero-mcp-http" ||
    value === "fixture" ||
    value === "zero-layer-bridge" ||
    value === "custom-command"
  ) {
    return value;
  }
  return "unknown";
}

export async function fetchZeroLayerSnapshotResult(nodeId: string): Promise<ZeroLayerSnapshotResult> {
  const response = await fetch("/api/zero/layer-snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId })
  });
  const payload = (await response.json()) as ZeroLayerSnapshotResponse;
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : `Zero layer request failed: ${response.status}`
    );
  }
  return {
    snapshot: normalizeZeroLayerSnapshot(payload.snapshot),
    source: normalizeSource(payload.source),
    ...(typeof payload.bridge === "string" ? { bridge: payload.bridge } : {})
  };
}

export async function fetchZeroLayerSnapshot(nodeId: string): Promise<ZeroLayerSnapshot> {
  return (await fetchZeroLayerSnapshotResult(nodeId)).snapshot;
}

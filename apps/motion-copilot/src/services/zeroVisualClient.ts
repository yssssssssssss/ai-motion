import { normalizeZeroVisualSnapshot, type ZeroVisualSnapshot } from "@motion-copilot/core";

export type ZeroVisualSnapshotSource = "real-zero-mcp-http" | "fixture" | "zero-mcp-bridge" | "custom-command" | "unknown";

export type ZeroVisualSnapshotResult = {
  snapshot: ZeroVisualSnapshot;
  source: ZeroVisualSnapshotSource;
  bridge?: string;
};

type ZeroVisualSnapshotResponse = {
  snapshot?: unknown;
  error?: unknown;
  source?: unknown;
  bridge?: unknown;
};

function normalizeSource(value: unknown): ZeroVisualSnapshotSource {
  if (
    value === "real-zero-mcp-http" ||
    value === "fixture" ||
    value === "zero-mcp-bridge" ||
    value === "custom-command"
  ) {
    return value;
  }
  return "unknown";
}

export async function fetchZeroVisualSnapshotResult(nodeId: string): Promise<ZeroVisualSnapshotResult> {
  const response = await fetch("/api/zero/visual-snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId })
  });
  const payload = (await response.json()) as ZeroVisualSnapshotResponse;
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : `Zero visual request failed: ${response.status}`
    );
  }
  return {
    snapshot: normalizeZeroVisualSnapshot(payload.snapshot),
    source: normalizeSource(payload.source),
    ...(typeof payload.bridge === "string" ? { bridge: payload.bridge } : {})
  };
}

export async function fetchZeroVisualSnapshot(nodeId: string): Promise<ZeroVisualSnapshot> {
  return (await fetchZeroVisualSnapshotResult(nodeId)).snapshot;
}

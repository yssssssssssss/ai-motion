import { normalizeFrameSnapshot, type FrameSnapshot } from "@motion-copilot/core";

type ZeroFrameSnapshotResponse = {
  snapshot?: unknown;
  error?: unknown;
};

export async function fetchZeroFrameSnapshot(nodeId: string): Promise<FrameSnapshot> {
  const response = await fetch("/api/zero/frame-snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId })
  });
  const payload = (await response.json()) as ZeroFrameSnapshotResponse;
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : `Zero frame request failed: ${response.status}`
    );
  }
  return normalizeFrameSnapshot(payload.snapshot);
}

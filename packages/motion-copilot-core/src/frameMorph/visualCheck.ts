import type { FrameSnapshot, MorphIssue } from "./schema";

export type FrameVisualCheckTarget = "from" | "to";

export type FrameVisualCheck = {
  frameId: string;
  target: FrameVisualCheckTarget;
  screenshotUrl: string;
  maxDifferenceRatio: number;
};

export type ScreenshotDiffInput = {
  changedPixels: number;
  totalPixels: number;
  maxDifferenceRatio: number;
};

export type PixelBufferDiffInput = {
  actual: ArrayLike<number>;
  expected: ArrayLike<number>;
  width: number;
  height: number;
  maxDifferenceRatio: number;
  perChannelThreshold?: number;
};

export type ScreenshotDiffResult = {
  passed: boolean;
  differenceRatio: number;
  maxDifferenceRatio: number;
  changedPixels: number;
  totalPixels: number;
};

function checkForFrame(
  frame: FrameSnapshot,
  target: FrameVisualCheckTarget,
  maxDifferenceRatio: number
): FrameVisualCheck | undefined {
  return frame.screenshotUrl
    ? {
        frameId: frame.frameId,
        target,
        screenshotUrl: frame.screenshotUrl,
        maxDifferenceRatio
      }
    : undefined;
}

export function createMorphVisualCheckPlan(
  input: { from: FrameSnapshot; to: FrameSnapshot },
  options: { maxDifferenceRatio?: number } = {}
): { checks: FrameVisualCheck[]; issues: MorphIssue[] } {
  const maxDifferenceRatio = options.maxDifferenceRatio ?? 0.04;
  const checks = [
    checkForFrame(input.from, "from", maxDifferenceRatio),
    checkForFrame(input.to, "to", maxDifferenceRatio)
  ].filter((item): item is FrameVisualCheck => Boolean(item));
  const issues: MorphIssue[] = [];

  if (!input.from.screenshotUrl) {
    issues.push({
      id: `visual-check-missing-${input.from.frameId}`,
      severity: "suggestion",
      title: "缺少首帧截图",
      reason: "没有 screenshotUrl 时无法做首帧高保真截图对比。"
    });
  }
  if (!input.to.screenshotUrl) {
    issues.push({
      id: `visual-check-missing-${input.to.frameId}`,
      severity: "suggestion",
      title: "缺少尾帧截图",
      reason: "没有 screenshotUrl 时无法做尾帧高保真截图对比。"
    });
  }

  return { checks, issues };
}

export function evaluateScreenshotDiff(input: ScreenshotDiffInput): ScreenshotDiffResult {
  const totalPixels = Math.max(1, Math.round(input.totalPixels));
  const changedPixels = Math.max(0, Math.round(input.changedPixels));
  const maxDifferenceRatio = Math.max(0, input.maxDifferenceRatio);
  const differenceRatio = changedPixels / totalPixels;
  return {
    passed: differenceRatio <= maxDifferenceRatio,
    differenceRatio,
    maxDifferenceRatio,
    changedPixels,
    totalPixels
  };
}

export function diffRgbaPixels(input: PixelBufferDiffInput): ScreenshotDiffResult {
  const width = Math.max(1, Math.round(input.width));
  const height = Math.max(1, Math.round(input.height));
  const totalPixels = width * height;
  const expectedLength = totalPixels * 4;
  if (input.actual.length < expectedLength || input.expected.length < expectedLength) {
    throw new Error("RGBA buffers are smaller than width * height * 4.");
  }

  const threshold = Math.max(0, input.perChannelThreshold ?? 8);
  let changedPixels = 0;
  for (let index = 0; index < expectedLength; index += 4) {
    const delta =
      Math.abs((input.actual[index] ?? 0) - (input.expected[index] ?? 0)) +
      Math.abs((input.actual[index + 1] ?? 0) - (input.expected[index + 1] ?? 0)) +
      Math.abs((input.actual[index + 2] ?? 0) - (input.expected[index + 2] ?? 0)) +
      Math.abs((input.actual[index + 3] ?? 0) - (input.expected[index + 3] ?? 0));
    if (delta > threshold) changedPixels += 1;
  }

  return evaluateScreenshotDiff({
    changedPixels,
    totalPixels,
    maxDifferenceRatio: input.maxDifferenceRatio
  });
}

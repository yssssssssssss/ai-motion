import type { MotionComponent } from "../library/componentLibrary";

export type VideoConversionStatus =
  | "queued"
  | "probing"
  | "sampling"
  | "planning"
  | "generating"
  | "verifying"
  | "completed"
  | "failed";

export type UploadedVideoInput = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  posterDataUrl?: string;
  frames?: Array<{
    id: string;
    timestampMs: number;
    dataUrl: string;
  }>;
  contactSheetDataUrl?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  fps?: number;
  motionHints?: VideoMotionHints;
};

export type VideoMotionDirection = "none" | "left" | "right" | "up" | "down";

export type VideoMotionHints = {
  direction: VideoMotionDirection;
  confidence: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type VideoConversionJob = {
  id: string;
  status: VideoConversionStatus;
  progress: number;
  currentStep: string;
  message: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
};

export type MotionPlan = {
  artboard: { width: number; height: number };
  durationMs: number;
  fps: number;
  strategy: "single-layer-code-draft";
  cssDefaults: {
    startX: number;
    startY: number;
    startScale: number;
    midScale: number;
    endX: number;
    endY: number;
    opacity: number;
    cornerRadius: number;
    enterOpacity: number;
  };
  notes: string[];
};

export type VerificationCheck = {
  id: string;
  label: string;
  status: "pass" | "fail";
  message: string;
};

export type VerificationReport = {
  checks: VerificationCheck[];
};

export type VideoMotionComponentDraft = {
  job: VideoConversionJob;
  plan: MotionPlan;
  component: MotionComponent;
  report: VerificationReport;
};

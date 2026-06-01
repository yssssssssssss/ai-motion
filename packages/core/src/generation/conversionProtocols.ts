export type ConversionSourceKind = "video" | "html-css" | "react" | "nextjs";

export type ConversionProtocol = {
  sourceKind: ConversionSourceKind;
  requiredInputs: string[];
  requiredOutputs: string[];
  constraints: string[];
};

const commonOutputs = ["source/index.html", "source/style.css", "motion.manifest.json", "metadata.json"];

export const conversionProtocols: ConversionProtocol[] = [
  {
    sourceKind: "video",
    requiredInputs: ["mp4/mov/gif/webm file", "frame or layer extraction hints"],
    requiredOutputs: commonOutputs,
    constraints: [
      "must expose editable timing params",
      "must create replaceable layer declarations when layers are detected"
    ]
  },
  {
    sourceKind: "html-css",
    requiredInputs: ["html entry", "local css/js/assets"],
    requiredOutputs: commonOutputs,
    constraints: ["must remove external scripts", "must map editable CSS variables into confirmed params"]
  },
  {
    sourceKind: "react",
    requiredInputs: ["component source", "style source"],
    requiredOutputs: commonOutputs,
    constraints: ["must render as static iframe HTML", "must convert props into manifest params"]
  },
  {
    sourceKind: "nextjs",
    requiredInputs: ["page/component source", "style source", "public assets"],
    requiredOutputs: commonOutputs,
    constraints: ["must remove server-only APIs", "must flatten route assets into source files"]
  }
];

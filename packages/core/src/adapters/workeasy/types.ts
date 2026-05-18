export type WorkEasyCategory = "buttons" | "cards" | "checkboxes";

export type WorkEasyComponentRecord = {
  id: string;
  title: string;
  author?: string;
  type: "html" | "react" | "vue" | "tsx" | "jsx" | "nextjs" | "lottie";
  framework?: "vanilla" | "react" | "vue" | "nextjs";
  tags: string[];
  description?: string;
  version?: string;
  htmlContent?: string;
  cssContent?: string;
  jsContent?: string;
  tsxContent?: string;
  jsxContent?: string;
  vueContent?: string;
};

export type WorkEasyImportIssue =
  | "missing-html"
  | "missing-css"
  | "unsupported-type"
  | "invalid-manifest"
  | "no-confirmed-params";

export type WorkEasySkip = {
  id: string;
  category: WorkEasyCategory;
  issue: WorkEasyImportIssue;
  message: string;
};

export type WorkEasyConversionInput = {
  category: WorkEasyCategory;
  record: WorkEasyComponentRecord;
};

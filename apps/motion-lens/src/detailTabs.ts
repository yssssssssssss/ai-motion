export type DetailTabId = "recommendation" | "evidence" | "preview" | "analysis";

export type DetailTab = {
  id: DetailTabId;
  label: string;
};

export const detailTabs: DetailTab[] = [
  { id: "recommendation", label: "推荐内容" },
  { id: "evidence", label: "评审依据" },
  { id: "preview", label: "预览参数" },
  { id: "analysis", label: "分析维度" }
];

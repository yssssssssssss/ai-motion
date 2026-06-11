import type { MotionComponent } from "./componentLibrary";

export type ComponentHealthStatus = "pass" | "warn" | "fail";

export type ComponentHealthCheck = {
  id: string;
  label: string;
  status: ComponentHealthStatus;
  message: string;
};

export type ComponentHealthReport = {
  score: number;
  checks: ComponentHealthCheck[];
};

function entryContent(component: MotionComponent): string {
  return component.source.files.find((file) => file.path === component.source.entry)?.content ?? "";
}

function sourceText(component: MotionComponent): string {
  return component.source.files.map((file) => file.content).join("\n");
}

function hasRenderableSource(component: MotionComponent): boolean {
  return entryContent(component).trim().length > 0;
}

function hasPlaybackProtocol(component: MotionComponent): boolean {
  const text = sourceText(component);
  return /window\.motionReplay|function\s+motionReplay|motionReplay\s*=/.test(text);
}

function hasLikelyAnimation(component: MotionComponent): boolean {
  const text = sourceText(component);
  return /@keyframes|\banimation\s*:|\btransition\s*:|requestAnimationFrame|setInterval|animate\s*\(/.test(
    text
  );
}

export function analyzeComponentHealth(component: MotionComponent): ComponentHealthReport {
  const checks: ComponentHealthCheck[] = [
    hasRenderableSource(component)
      ? {
          id: "renderable-source",
          label: "可预览源码",
          status: "pass",
          message: "入口文件包含可渲染内容"
        }
      : {
          id: "renderable-source",
          label: "可预览源码",
          status: "fail",
          message: "入口文件仍是占位内容，需要先补全源码"
        },
    hasLikelyAnimation(component)
      ? {
          id: "motion-detected",
          label: "动效检测",
          status: "pass",
          message: "源码中检测到动画或过渡"
        }
      : {
          id: "motion-detected",
          label: "动效检测",
          status: "warn",
          message: "未检测到明显动画语义"
        },
    hasPlaybackProtocol(component)
      ? {
          id: "playback-protocol",
          label: "播放协议",
          status: "pass",
          message: "组件显式支持 motionReplay"
        }
      : {
          id: "playback-protocol",
          label: "播放协议",
          status: "warn",
          message: "组件依赖预览容器兜底重播"
        },
    component.manifest.params.length > 0
      ? {
          id: "editable-params",
          label: "可编辑参数",
          status: "pass",
          message: `包含 ${component.manifest.params.length} 个参数`
        }
      : {
          id: "editable-params",
          label: "可编辑参数",
          status: "warn",
          message: "当前组件没有可编辑参数"
        },
    component.manifest.capabilities?.includes("export-html")
      ? {
          id: "exportable",
          label: "可导出",
          status: "pass",
          message: "manifest 标记支持 HTML 导出"
        }
      : {
          id: "exportable",
          label: "可导出",
          status: "warn",
          message: "manifest 未显式标记导出能力"
        }
  ];
  const score = Math.round(
    (checks.reduce(
      (total, check) => total + (check.status === "pass" ? 1 : check.status === "warn" ? 0.5 : 0),
      0
    ) /
      checks.length) *
      100
  );

  return { score, checks };
}

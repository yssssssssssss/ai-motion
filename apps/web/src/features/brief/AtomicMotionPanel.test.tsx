import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AtomicMotionPanel } from "./AtomicMotionPanel";

describe("AtomicMotionPanel", () => {
  it("renders compact element cards with variants expanded under the selected element", () => {
    const html = renderToStaticMarkup(
      createElement(AtomicMotionPanel, {
        elements: [
          {
            id: "popup-feedback",
            label: "弹窗反馈",
            latestVersion: "1.0.0",
            active: true,
            variants: ["中型尺寸"],
            packPath: "popup-feedback/manifest.json"
          },
          {
            id: "front-back-entry",
            label: "前后进场",
            latestVersion: "0.0.0",
            active: false,
            variants: ["半弹层"],
            packPath: "",
            status: "incomplete",
            reason: "缺少完整 token 行"
          }
        ],
        selectedElementId: "popup-feedback",
        selectedVariant: "中型尺寸",
        onSelectElement: () => {},
        onSelectVariant: () => {}
      })
    );

    expect(html).toContain("弹窗反馈");
    expect(html).toContain("atomic-motion-element-grid");
    expect(html).toContain("元素横向卡片列表");
    expect(html).toContain("atomic-motion-variant-tray");
    expect(html).toContain("中型尺寸");
    expect(html).not.toContain("触发方式");
    expect(html).not.toContain("加载");
    expect(html).not.toContain("点击");
    expect(html).not.toContain("悬停");
    expect(html).not.toContain("循环");
    expect(html).not.toContain("滑动");
    expect(html).not.toContain("atomic-motion-trigger-pill");
    expect(html).not.toContain("Designer CSV");
    expect(html).not.toContain("原子动效参数");
    expect(html).not.toContain("atomic-motion-scroll-controls");
    expect(html).not.toContain("atomic-motion-scroll-button");
    expect(html).not.toContain("向左滚动");
    expect(html).not.toContain("向右滚动");
    expect(html).not.toContain("应用对象");
    expect(html).not.toContain("弹窗图层");
    expect(html).not.toContain("当前草稿图层");
    expect(html).not.toContain("缩放 · 200ms");
    expect(html).not.toContain("atomic-motion-summary");
    expect(html).not.toContain("atomic-motion-meta-card");
    expect(html).toContain("前后进场");
    expect(html).not.toContain("缺少完整 token 行");
    expect(html).not.toContain("atomic-motion-options is-compact");
    expect(html).toContain('aria-label="原子动效配置"');
    expect(html).not.toContain("atomic-motion-backdrop");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("关闭");
    expect(html).not.toContain("取消");
  });

  it("does not render trigger controls", () => {
    const html = renderToStaticMarkup(
      createElement(AtomicMotionPanel, {
        elements: [
          {
            id: "popup-close",
            label: "弹窗关闭",
            latestVersion: "1.0.0",
            active: true,
            variants: ["all"],
            packPath: "popup-close/manifest.json"
          }
        ],
        selectedElementId: "popup-close",
        selectedVariant: "all",
        onSelectElement: () => {},
        onSelectVariant: () => {}
      })
    );

    expect(html).toContain("弹窗关闭");
    expect(html).not.toContain("加载</button>");
    expect(html).not.toContain("点击</button>");
    expect(html).not.toContain("悬停");
    expect(html).not.toContain("循环");
    expect(html).not.toContain("滑动");
    expect(html).not.toContain("触发方式");
  });

  it("renders container transform product card without trigger controls", () => {
    const html = renderToStaticMarkup(
      createElement(AtomicMotionPanel, {
        elements: [
          {
            id: "container-transform",
            label: "容器变换",
            latestVersion: "1.0.0",
            active: true,
            variants: ["商卡"],
            packPath: "container-transform/manifest.json"
          }
        ],
        selectedElementId: "container-transform",
        selectedVariant: "商卡",
        onSelectElement: () => {},
        onSelectVariant: () => {}
      })
    );

    expect(html).toContain("容器变换");
    expect(html).toContain("商卡");
    expect(html).not.toContain("点击</button>");
    expect(html).not.toContain("加载</button>");
    expect(html).not.toContain("悬停");
    expect(html).not.toContain("循环");
    expect(html).not.toContain("滑动");
  });
});

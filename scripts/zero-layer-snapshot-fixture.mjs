#!/usr/bin/env node

const nodeIdIndex = process.argv.indexOf("--node-id");
const nodeId = nodeIdIndex >= 0 ? process.argv[nodeIdIndex + 1] : "";

function dataSvg(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function layer(nodeId, parentId, name, kind, x, y, w, h, extra = {}) {
  return {
    nodeId,
    ...(parentId ? { parentId } : {}),
    name,
    kind,
    bounds: { x, y, w, h },
    opacity: 1,
    visible: true,
    ...extra
  };
}

const assets = {
  shell: dataSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" rx="0.2" fill="none" stroke="#e5e5e5"/></svg>'
  )
};

const commonTextStyle = { fontFamily: '"PingFang SC", Arial, sans-serif', fontSize: 12, fontWeight: 500, lineHeight: 16 };

const snapshots = {
  "28:19": {
    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
    frameId: "28:19",
    nodeId: "28:19",
    name: "信息收起状态",
    width: 505,
    height: 38,
    screenshotUrl: "data:image/png;base64,RkFLRV9GUk9N",
    assets: [{ id: "asset-shell", type: "svg", url: assets.shell }],
    layers: [
      layer("28:19", undefined, "信息收起状态", "frame", 0, 0, 505, 38, {
        fills: [{ type: "solid", color: "#ffffff", opacity: 0 }]
      }),
      layer("28:28", "28:19", "组件背景", "rect", 0, 0, 288, 38, {
        cornerRadius: 8,
        fills: [{ type: "solid", color: "#ffffff", opacity: 0 }]
      }),
      layer("28:29", "28:19", "指派域产品", "text", 12, 10, 60, 17, {
        text: "指派域产品",
        fills: [{ type: "solid", color: "#000000" }],
        textStyle: commonTextStyle
      }),
      layer("28:31", "28:19", "继续指派背景", "rect", 195, 4, 88, 30, {
        cornerRadius: 36,
        fills: [{ type: "solid", color: "#000000" }]
      }),
      layer("28:32", "28:19", "继续指派文字", "text", 209, 10, 60, 17, {
        text: "继续指派 >",
        fills: [{ type: "solid", color: "#ffffff" }],
        textStyle: commonTextStyle
      }),
      layer("28:34", "28:19", "状态胶囊", "rect", 78, 6, 108, 26, {
        cornerRadius: 999,
        fills: [{ type: "solid", color: "#f3f3f3" }]
      }),
      layer("28:36", "28:19", "待确认数字", "text", 103, 11, 8, 17, {
        text: "2",
        fills: [{ type: "solid", color: "#cdab18" }],
        textStyle: commonTextStyle
      })
    ]
  },
  "28:2": {
    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
    frameId: "28:2",
    nodeId: "28:2",
    name: "信息展开状态",
    width: 583,
    height: 38,
    screenshotUrl: "data:image/png;base64,RkFLRV9UTw==",
    assets: [{ id: "asset-shell", type: "svg", url: assets.shell }],
    layers: [
      layer("28:2", undefined, "信息展开状态", "frame", 0, 0, 583, 38, {
        fills: [{ type: "solid", color: "#ffffff", opacity: 0 }]
      }),
      layer("28:7", "28:2", "组件背景", "rect", 0, 0, 366, 38, {
        cornerRadius: 8,
        fills: [{ type: "solid", color: "#ffffff", opacity: 0 }]
      }),
      layer("28:8", "28:2", "指派域产品", "text", 13, 10, 60, 17, {
        text: "指派域产品",
        fills: [{ type: "solid", color: "#000000" }],
        textStyle: commonTextStyle
      }),
      layer("28:10", "28:2", "继续指派背景", "rect", 273, 4, 88, 30, {
        cornerRadius: 36,
        fills: [{ type: "solid", color: "#000000" }]
      }),
      layer("28:11", "28:2", "继续指派文字", "text", 287, 10, 60, 17, {
        text: "继续指派 >",
        fills: [{ type: "solid", color: "#ffffff" }],
        textStyle: commonTextStyle
      }),
      layer("28:12", "28:2", "状态胶囊", "rect", 79, 6, 185, 26, {
        cornerRadius: 999,
        fills: [{ type: "solid", color: "#f3f3f3" }]
      }),
      layer("28:14", "28:2", "待确认文字", "text", 88, 10, 48, 17, {
        text: "待确认 2",
        fills: [{ type: "solid", color: "#cdab18" }],
        textStyle: commonTextStyle
      }),
      layer("28:15", "28:2", "已接受文字", "text", 149, 10, 45, 17, {
        text: "已接受 1",
        fills: [{ type: "solid", color: "#09ae28" }],
        textStyle: commonTextStyle
      }),
      layer("28:13", "28:2", "已拒绝文字", "text", 206, 10, 48, 17, {
        text: "已拒绝 3",
        fills: [{ type: "solid", color: "#ff3434" }],
        textStyle: commonTextStyle
      })
    ]
  }
};

if (!snapshots[nodeId]) {
  console.error(`Unsupported fixture nodeId: ${nodeId || "(empty)"}`);
  process.exit(1);
}

process.stdout.write(`${JSON.stringify(snapshots[nodeId], null, 2)}\n`);

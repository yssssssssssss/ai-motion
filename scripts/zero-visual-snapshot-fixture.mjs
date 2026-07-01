#!/usr/bin/env node

const nodeIdIndex = process.argv.indexOf("--node-id");
const nodeId = nodeIdIndex >= 0 ? process.argv[nodeIdIndex + 1] : "";

function dataSvg(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const assets = {
  bg106: dataSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="106" height="38"><rect x="0.5" y="0.5" width="105" height="37" rx="84" fill="none" stroke="#e5e5e5"/></svg>'
  ),
  bg83: dataSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="83" height="38"><rect x="0.5" y="0.5" width="82" height="37" rx="84" fill="none" stroke="#e5e5e5"/></svg>'
  ),
  bg366: dataSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="366" height="38"><rect width="366" height="38" rx="8" fill="none"/></svg>'
  ),
  bg288: dataSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="288" height="38"><rect width="288" height="38" rx="8" fill="none"/></svg>'
  ),
  dotPending: dataSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="4" fill="#cdab18"/></svg>'
  ),
  dotAccepted: dataSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="4" fill="#09ae28"/></svg>'
  ),
  dotRejected: dataSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="4" fill="#ff3434"/></svg>'
  )
};

const css = `
.zero-frame{position:relative;color:#000;font-family:"PingFang SC",Arial,sans-serif;font-size:12px;line-height:normal;}
.zero-group,.zero-vector,.zero-text,.zero-pill,.zero-button{position:absolute;box-sizing:border-box;}
.zero-text{white-space:nowrap;font-weight:500;word-break:break-word;display:flex;align-items:center;}
.zero-text.semibold{font-weight:600;}
.zero-vector{display:flex;align-items:center;justify-content:center;}
.zero-vector img{display:block;width:100%;height:100%;}
.zero-button{border-radius:36px;background:#000;display:flex;align-items:center;justify-content:center;}
.zero-pill{border-radius:25px;background:#f3f3f3;display:flex;align-items:center;justify-content:center;}
`.trim();

function text(id, x, y, w, h, value, color = "#000", className = "") {
  return `<p class="zero-text ${className}" data-node-id="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;color:${color}">${value}</p>`;
}

function vector(id, x, y, w, h, assetId) {
  return `<div class="zero-vector" data-node-id="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><img alt="" src="${assets[assetId]}" /></div>`;
}

function node(nodeId, name, kind, x, y, w, h, extra = {}) {
  return { nodeId, name, kind, bounds: { x, y, w, h }, ...extra };
}

const snapshots = {
  "28:2": {
    schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
    frameId: "28:2",
    nodeId: "28:2",
    name: "信息展开状态",
    width: 583,
    height: 38,
    screenshotUrl:
      "https://img20.360buyimg.com/img/jfs/t1/458324/21/15796/14065/6a3f42e5F5e3883b2/02762510308a7d8f.png",
    html: `
<div class="zero-frame" data-node-id="28:2" style="width:583px;height:38px">
  <div class="zero-group" data-node-id="28:3" style="left:477px;top:0;width:106px;height:38px">
    ${vector("28:4", 0, 0, 106, 38, "bg106")}
    ${text("28:5", 17, 10.5, 72, 17, "邀请主架构 &gt;", "#000", "semibold")}
  </div>
  <div class="zero-group" data-node-id="28:6" style="left:0;top:0;width:366px;height:38px">
    ${vector("28:7", 0, 0, 366, 38, "bg366")}
    ${text("28:8", 13, 10, 60, 17, "指派域产品")}
    <div class="zero-group" data-node-id="28:9" style="left:273px;top:4px;width:88px;height:30px">
      <div class="zero-button" data-node-id="28:10" style="left:0;top:0;width:88px;height:30px"></div>
      ${text("28:11", 14, 6, 60, 17, "继续指派 &gt;", "#fff")}
    </div>
    <div class="zero-pill" data-node-id="28:12" style="left:79px;top:6px;width:185px;height:26px"></div>
    ${text("28:13", 206, 10, 48, 17, "已拒绝 3", "#ff3434")}
    ${text("28:14", 88, 10, 48, 17, "待确认 2", "#cdab18")}
    ${text("28:15", 149, 10, 45, 17, "已接受 1", "#09ae28")}
  </div>
  <div class="zero-group" data-node-id="28:16" style="left:380px;top:0;width:83px;height:38px">
    ${vector("28:17", 0, 0, 83, 38, "bg83")}
    ${text("28:18", 17, 10, 49, 17, "生成PRD", "#000", "semibold")}
  </div>
</div>`.trim(),
    css,
    assets: [
      { id: "asset-28-4", type: "svg", url: assets.bg106, nodeId: "28:4", width: 106, height: 38 },
      { id: "asset-28-7", type: "svg", url: assets.bg366, nodeId: "28:7", width: 366, height: 38 },
      { id: "asset-28-17", type: "svg", url: assets.bg83, nodeId: "28:17", width: 83, height: 38 }
    ],
    nodes: [
      node("28:2", "信息展开状态", "group", 0, 0, 583, 38),
      node("28:3", "组 490", "group", 477, 0, 106, 38),
      node("28:4", "矩形 5093", "vector", 477, 0, 106, 38, { assetId: "asset-28-4" }),
      node("28:5", "文字 140", "text", 494, 10.5, 72, 17, { text: "邀请主架构 >" }),
      node("28:6", "组 491", "group", 0, 0, 366, 38),
      node("28:7", "矩形 5126", "vector", 0, 0, 366, 38, { assetId: "asset-28-7" }),
      node("28:8", "文字 159", "text", 13, 10, 60, 17, { text: "指派域产品" }),
      node("28:9", "组 431", "group", 273, 4, 88, 30),
      node("28:10", "矩形 5125", "rect", 273, 4, 88, 30),
      node("28:11", "文字 159", "text", 287, 10, 60, 17, { text: "继续指派 >" }),
      node("28:12", "矩形 5127", "rect", 79, 6, 185, 26),
      node("28:13", "文字 159", "text", 206, 10, 48, 17, { text: "已拒绝 3" }),
      node("28:14", "文字 159", "text", 88, 10, 48, 17, { text: "待确认 2" }),
      node("28:15", "文字 159", "text", 149, 10, 45, 17, { text: "已接受 1" }),
      node("28:16", "组 497", "group", 380, 0, 83, 38),
      node("28:17", "矩形 5096", "vector", 380, 0, 83, 38, { assetId: "asset-28-17" }),
      node("28:18", "文字 140", "text", 397, 10, 49, 17, { text: "生成PRD" })
    ]
  },
  "28:19": {
    schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
    frameId: "28:19",
    nodeId: "28:19",
    name: "信息收起状态",
    width: 505,
    height: 38,
    screenshotUrl:
      "https://img30.360buyimg.com/img/jfs/t1/458324/21/15796/14065/6a3f42e5F46019c47/0276203030c2f3e8.png",
    html: `
<div class="zero-frame" data-node-id="28:19" style="width:505px;height:38px">
  <div class="zero-group" data-node-id="28:20" style="left:399px;top:0;width:106px;height:38px">
    ${vector("28:21", 0, 0, 106, 38, "bg106")}
    ${text("28:22", 17, 10.5, 72, 17, "邀请主架构 &gt;", "#000", "semibold")}
  </div>
  <div class="zero-group" data-node-id="28:23" style="left:302px;top:0;width:83px;height:38px">
    ${vector("28:24", 0, 0, 83, 38, "bg83")}
    ${text("28:25", 17, 10, 49, 17, "生成PRD", "#000", "semibold")}
  </div>
  <div class="zero-group" data-node-id="28:26" style="left:0;top:0;width:288px;height:38px">
    <div class="zero-group" data-node-id="28:27" style="left:0;top:0;width:288px;height:38px">
      ${vector("28:28", 0, 0, 288, 38, "bg288")}
      ${text("28:29", 12, 10, 60, 17, "指派域产品")}
      <div class="zero-group" data-node-id="28:30" style="left:195px;top:4px;width:88px;height:30px">
        <div class="zero-button" data-node-id="28:31" style="left:0;top:0;width:88px;height:30px"></div>
        ${text("28:32", 14, 6, 60, 17, "继续指派 &gt;", "#fff")}
      </div>
    </div>
    <div class="zero-group" data-node-id="28:33" style="left:78px;top:6px;width:108px;height:26px">
      <div class="zero-pill" data-node-id="28:34" style="left:0;top:0;width:108px;height:26px"></div>
      <div class="zero-group" data-node-id="28:35" style="left:12px;top:5px;width:21px;height:17px">
        ${text("28:36", 13, 0, 8, 17, "2", "#cdab18")}
        ${vector("28:37", 0, 4.5, 8, 8, "dotPending")}
      </div>
      <div class="zero-group" data-node-id="28:38" style="left:45px;top:5px;width:18px;height:17px">
        ${text("28:39", 13, 0, 5, 17, "1", "#09ae28")}
        ${vector("28:40", 0, 4.5, 8, 8, "dotAccepted")}
      </div>
      <div class="zero-group" data-node-id="28:41" style="left:75px;top:5px;width:21px;height:17px">
        ${text("28:42", 13, 0, 8, 17, "3", "#ff3434")}
        ${vector("28:43", 0, 5, 8, 8, "dotRejected")}
      </div>
    </div>
  </div>
</div>`.trim(),
    css,
    assets: [
      { id: "asset-28-21", type: "svg", url: assets.bg106, nodeId: "28:21", width: 106, height: 38 },
      { id: "asset-28-24", type: "svg", url: assets.bg83, nodeId: "28:24", width: 83, height: 38 },
      { id: "asset-28-28", type: "svg", url: assets.bg288, nodeId: "28:28", width: 288, height: 38 },
      { id: "asset-28-37", type: "svg", url: assets.dotPending, nodeId: "28:37", width: 8, height: 8 },
      { id: "asset-28-40", type: "svg", url: assets.dotAccepted, nodeId: "28:40", width: 8, height: 8 },
      { id: "asset-28-43", type: "svg", url: assets.dotRejected, nodeId: "28:43", width: 8, height: 8 }
    ],
    nodes: [
      node("28:19", "信息收起状态", "group", 0, 0, 505, 38),
      node("28:20", "组 499", "group", 399, 0, 106, 38),
      node("28:21", "矩形 5093", "vector", 399, 0, 106, 38, { assetId: "asset-28-21" }),
      node("28:22", "文字 140", "text", 416, 10.5, 72, 17, { text: "邀请主架构 >" }),
      node("28:23", "组 501", "group", 302, 0, 83, 38),
      node("28:24", "矩形 5096", "vector", 302, 0, 83, 38, { assetId: "asset-28-24" }),
      node("28:25", "文字 140", "text", 319, 10, 49, 17, { text: "生成PRD" }),
      node("28:26", "组 508", "group", 0, 0, 288, 38),
      node("28:27", "组 500", "group", 0, 0, 288, 38),
      node("28:28", "矩形 5126", "vector", 0, 0, 288, 38, { assetId: "asset-28-28" }),
      node("28:29", "文字 159", "text", 12, 10, 60, 17, { text: "指派域产品" }),
      node("28:30", "组 431", "group", 195, 4, 88, 30),
      node("28:31", "矩形 5125", "rect", 195, 4, 88, 30),
      node("28:32", "文字 159", "text", 209, 10, 60, 17, { text: "继续指派 >" }),
      node("28:33", "组 509", "group", 78, 6, 108, 26),
      node("28:34", "矩形 5127", "rect", 78, 6, 108, 26),
      node("28:35", "组 502", "group", 90, 11, 21, 17),
      node("28:36", "文字 159", "text", 103, 11, 8, 17, { text: "2" }),
      node("28:37", "圆形 1", "vector", 90, 15.5, 8, 8, { assetId: "asset-28-37" }),
      node("28:38", "组 504", "group", 123, 11, 18, 17),
      node("28:39", "文字 159", "text", 136, 11, 5, 17, { text: "1" }),
      node("28:40", "圆形 2", "vector", 123, 15.5, 8, 8, { assetId: "asset-28-40" }),
      node("28:41", "组 503", "group", 153, 11, 21, 17),
      node("28:42", "文字 159", "text", 166, 11, 8, 17, { text: "3" }),
      node("28:43", "圆形 3", "vector", 153, 16, 8, 8, { assetId: "asset-28-43" })
    ]
  }
};

if (!snapshots[nodeId]) {
  console.error(`Unsupported fixture nodeId: ${nodeId || "(empty)"}`);
  process.exit(1);
}

process.stdout.write(`${JSON.stringify(snapshots[nodeId], null, 2)}\n`);

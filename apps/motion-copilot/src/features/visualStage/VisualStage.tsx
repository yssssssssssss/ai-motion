import { useEffect, useMemo, useRef } from "react";
import { ZERO_VISUAL_STAGE_ALIGNMENT_CSS, type ZeroVisualSnapshot } from "@motion-copilot/core";

type VisualStageMessage = {
  type?: unknown;
  nodeId?: unknown;
};

export type VisualStageProps = {
  snapshot: ZeroVisualSnapshot;
  highlightedNodeId?: string | undefined;
  motionCss?: string | undefined;
  overrideCss?: string | undefined;
  stageWidth?: number | undefined;
  stageHeight?: number | undefined;
  onNodeSelect?: (nodeId: string) => void;
};

function cssAttributeValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function buildVisualStageSrcDoc(
  snapshot: ZeroVisualSnapshot,
  highlightedNodeId?: string,
  motionCss = "",
  overrideCss = ""
): string {
  const highlightedNode = highlightedNodeId
    ? snapshot.nodes.find((node) => node.nodeId === highlightedNodeId)
    : undefined;
  const highlightCss = highlightedNode
    ? `[data-node-id="${cssAttributeValue(highlightedNode.nodeId)}"]{outline:1px solid #1677ff;outline-offset:2px;}`
    : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    html,body{margin:0;padding:0;background:transparent;overflow:hidden;}
    *{box-sizing:border-box;}
    ${snapshot.css}
    ${ZERO_VISUAL_STAGE_ALIGNMENT_CSS}
    ${overrideCss}
    ${motionCss}
    ${highlightCss}
  </style>
</head>
<body>
${snapshot.html}
<script>
  document.addEventListener("click", function(event) {
    var target = event.target && event.target.closest ? event.target.closest("[data-node-id]") : null;
    if (!target) return;
    parent.postMessage({
      type: "motion-copilot:zero-node-select",
      nodeId: target.getAttribute("data-node-id")
    }, "*");
  });
</script>
</body>
</html>`;
}

export function VisualStage({
  snapshot,
  highlightedNodeId,
  motionCss,
  overrideCss,
  stageWidth,
  stageHeight,
  onNodeSelect
}: VisualStageProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const srcDoc = useMemo(
    () => buildVisualStageSrcDoc(snapshot, highlightedNodeId, motionCss, overrideCss),
    [highlightedNodeId, motionCss, overrideCss, snapshot]
  );

  useEffect(() => {
    if (!onNodeSelect) return undefined;
    const emitNodeSelect = onNodeSelect;

    function handleMessage(event: MessageEvent<VisualStageMessage>) {
      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return;
      if (event.data?.type !== "motion-copilot:zero-node-select") return;
      if (typeof event.data.nodeId !== "string") return;
      if (!snapshot.nodes.some((node) => node.nodeId === event.data.nodeId)) return;
      emitNodeSelect(event.data.nodeId);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onNodeSelect, snapshot.nodes]);

  return (
    <iframe
      ref={iframeRef}
      className="visual-stage"
      title={snapshot.name}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={{ width: stageWidth ?? snapshot.width, height: stageHeight ?? snapshot.height }}
    />
  );
}

export type SemanticGenerationRole =
  | "button"
  | "card"
  | "text"
  | "badge"
  | "loader"
  | "page-transition"
  | "mobile-page";
export type SemanticGenerationEffect =
  | "bounce"
  | "elastic"
  | "slide"
  | "scale"
  | "glow"
  | "fade"
  | "rotate"
  | "pulse"
  | "float";
export type SemanticGenerationDirection =
  | "left-to-right"
  | "right-to-left"
  | "top-to-bottom"
  | "bottom-to-top";
export type SemanticGenerationTrigger = "load" | "hover" | "click" | "loop";
export type SemanticGenerationSpeed = "fast" | "normal" | "slow";
export type SemanticGenerationColorTarget = "background" | "text" | "border" | "accent";

export type SemanticGenerationColor = {
  target: SemanticGenerationColorTarget;
  label: string;
  value: string;
};

export type SemanticGenerationIntent = {
  role: SemanticGenerationRole | null;
  colors: SemanticGenerationColor[];
  effects: SemanticGenerationEffect[];
  direction: SemanticGenerationDirection | null;
  trigger: SemanticGenerationTrigger;
  speed: SemanticGenerationSpeed;
  text: string | null;
  softPreferences: string[];
  negativePreferences: string[];
  referenceHints: string[];
  raw: string;
};

const COLOR_ALIASES: Array<{ labels: string[]; label: string; value: string }> = [
  { labels: ["红色", "red", "粉红", "pink"], label: "红色", value: "#ef4444" },
  { labels: ["蓝色", "blue"], label: "蓝色", value: "#2563eb" },
  { labels: ["紫色", "purple", "violet"], label: "紫色", value: "#7c3aed" },
  { labels: ["绿色", "green"], label: "绿色", value: "#16a34a" },
  { labels: ["橙色", "orange"], label: "橙色", value: "#f97316" },
  { labels: ["黄色", "yellow", "金色", "gold"], label: "黄色", value: "#facc15" },
  { labels: ["黑色", "black", "深色"], label: "黑色", value: "#111827" },
  { labels: ["白色", "white"], label: "白色", value: "#ffffff" },
  { labels: ["灰色", "gray", "grey"], label: "灰色", value: "#6b7280" }
];

function includesAny(value: string, aliases: string[]): boolean {
  return aliases.some((alias) => value.includes(alias.toLowerCase()));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function extractQuotedText(brief: string): string | null {
  const match = brief.match(/[「『“"]([^」』”"]{1,80})[」』”"]/);
  return match?.[1]?.trim() || null;
}

function extractLabeledText(brief: string): string | null {
  const match = brief.match(/(?:按钮文案|标题文案|文案|文字|内容|label)\s*(?:是|为|:|：)\s*([^，。；;\n]{1,80})/i);
  const value = match?.[1]?.trim().replace(/^["'「『“]+|["'」』”]+$/g, "");
  return value || null;
}

function colorTarget(lower: string): SemanticGenerationColorTarget {
  if (/(文字|文本|text|font)/i.test(lower)) return "text";
  if (/(边框|描边|border|stroke)/i.test(lower)) return "border";
  if (/(强调|点缀|accent)/i.test(lower)) return "accent";
  return "background";
}

const NEGATED_CLAUSE_PATTERN = /(?:不要|别|不需要|无需|不是|排除|禁止|别再|不要再)\s*([^，。；;,.!！?？\n]{1,80})/gi;

function negativeClauses(raw: string): string[] {
  return [...raw.matchAll(NEGATED_CLAUSE_PATTERN)]
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean);
}

function positiveText(raw: string): string {
  return raw.replace(NEGATED_CLAUSE_PATTERN, " ");
}

function referenceHints(raw: string): string[] {
  const hints: string[] = [];
  for (const match of raw.matchAll(/(?:基于|参考|像|按照|以|用)\s*([^，。；;,.!！?？\n]{2,80})/gi)) {
    const value = match[1]?.trim();
    if (value) hints.push(value);
  }
  if (/(jd-front-back-entry-transition|前后进场代码动效|前后进场|前后切换|页面转场|页面切换|页面.*切换|page-transition|screen-transition)/i.test(raw)) {
    hints.push("jd-front-back-entry-transition", "前后进场代码动效", "page-transition");
  }
  return unique(hints);
}

function isPageTransitionIntent(value: string): boolean {
  return /(jd-front-back-entry-transition|前后进场|前后切换|页面转场|页面切换|页面.*切换|前页|后页|移动端.*转场|page-transition|screen-transition|front.*back.*entry)/i.test(
    value
  );
}

function isMobilePageIntent(value: string): boolean {
  return /(移动端页面|手机页面|移动页面|app页面|mobile page|mobile screen|页面.*图层|页面.*背景层|页面.*前景层|页面.*漂浮|前景图层|背景图层|前景层|背景层|图层.*入场)/i.test(
    value
  );
}

export function parseSemanticGenerationIntent(brief: string): SemanticGenerationIntent {
  const raw = brief.trim();
  const positive = positiveText(raw);
  const motionText = positive.replace(/移动端页面|移动端|移动页面|移动设备/gi, " ");
  const lower = positive.toLowerCase();
  const negatives = negativeClauses(raw);
  const refs = referenceHints(raw);
  const effects: SemanticGenerationEffect[] = [];

  if (/(按钮|button|cta)/i.test(positive)) {
    // role is set below
  }
  if (/(弹动|弹性|弹跳|bounce|spring|elastic)/i.test(motionText)) effects.push("bounce", "elastic");
  if (/(滑动|位移|移动|进入距离|退出距离|translate|slide|左侧|右侧|上方|下方|前页|后页)/i.test(motionText))
    effects.push("slide");
  if (/(缩放|放大|scale)/i.test(motionText)) effects.push("scale");
  if (/(发光|光晕|glow|shadow|霓虹)/i.test(motionText)) effects.push("glow");
  if (/(淡入|淡出|fade|透明|泛白)/i.test(motionText)) effects.push("fade");
  if (/(旋转|rotate)/i.test(motionText)) effects.push("rotate");
  if (/(脉冲|呼吸|pulse|pulsing)/i.test(motionText)) effects.push("pulse");
  if (/(漂浮|浮动|float|floating|缓慢飘|轻微飘)/i.test(motionText)) effects.push("float");

  let role: SemanticGenerationRole | null = null;
  if (isPageTransitionIntent(positive)) role = "page-transition";
  else if (isMobilePageIntent(positive)) role = "mobile-page";
  else if (/(按钮|button|cta)/i.test(positive)) role = "button";
  else if (/(卡片|card)/i.test(positive)) role = "card";
  else if (/(标签|徽章|badge|tag|pill)/i.test(positive)) role = "badge";
  else if (/(加载|载入|loading|loader|spinner|进度条)/i.test(positive)) role = "loader";
  else if (/(文字|标题|text|headline|title)/i.test(positive)) role = "text";

  let direction: SemanticGenerationDirection | null = null;
  if (/(前页.*左.*后页.*右|后页.*右.*进|右.*左|right.*left|from\s+right|right-to-left)/i.test(positive))
    direction = "right-to-left";
  else if (/(左.*右|left.*right|from\s+left|left-to-right)/i.test(positive)) direction = "left-to-right";
  else if (/(上.*下|top.*bottom|from\s+top|top-to-bottom)/i.test(positive)) direction = "top-to-bottom";
  else if (/(下.*上|bottom.*top|from\s+bottom|bottom-to-top)/i.test(positive)) direction = "bottom-to-top";

  const colors = COLOR_ALIASES.flatMap((item) =>
    includesAny(lower, item.labels) ? [{ target: colorTarget(lower), label: item.label, value: item.value }] : []
  );

  let trigger: SemanticGenerationTrigger = "load";
  if (/(悬停|hover)/i.test(positive)) trigger = "hover";
  else if (/(点击|click|tap)/i.test(positive)) trigger = "click";
  else if (/(循环|loop|infinite|加载|载入|loading|loader|spinner|进度条)/i.test(positive)) trigger = "loop";
  else if (effects.includes("float") || effects.includes("pulse")) trigger = "loop";

  let speed: SemanticGenerationSpeed = "normal";
  if (/(快|快速|紧凑|fast|faster|quick)/i.test(positive)) speed = "fast";
  else if (/(慢|舒缓|slow|relaxed)/i.test(positive)) speed = "slow";

  return {
    role,
    colors,
    effects: unique(effects),
    direction,
    trigger,
    speed,
    text: extractQuotedText(raw) ?? extractLabeledText(raw),
    softPreferences: unique([
      ...(role ? [role] : []),
      ...colors.map((color) => color.label),
      ...effects,
      ...(direction ? [direction] : []),
      trigger,
      speed,
      ...refs
    ]),
    negativePreferences: unique(negatives),
    referenceHints: refs,
    raw
  };
}

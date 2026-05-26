export type ColorFacet = {
  primary: string;
  secondary: string[];
  isDark: boolean;
  isGradient: boolean;
  traits: string[];
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 3 && normalized.length !== 6) return null;
  const value =
    normalized.length === 3
      ? normalized.split("").map((p) => p + p).join("")
      : normalized;
  const intValue = Number.parseInt(value, 16);
  if (!Number.isFinite(intValue)) return null;
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255
  };
}

function rgbToHue({ r, g, b }: { r: number; g: number; b: number }): number {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (delta === 0) return 0;
  if (max === red) return ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
  if (max === green) return ((blue - red) / delta + 2) * 60;
  return ((red - green) / delta + 4) * 60;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

function parseColor(value: string): { r: number; g: number; b: number } | null {
  const trimmed = value.trim().toLowerCase();
  const hexMatch = trimmed.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) return hexToRgb(hexMatch[0]);
  const rgbMatch = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    if (!r || !g || !b) return null;
    return { r: +r, g: +g, b: +b };
  }
  const hslMatch = trimmed.match(/^hsla?\((\d+),\s*(\d+)%,\s*(\d+)/);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    if (!h || !s || !l) return null;
    return hslToRgb(+h, +s, +l);
  }
  return null;
}

function hueToTraits(hue: number, brightness: number): string[] {
  if (brightness < 48) return ["黑色", "深色", "black", "dark"];
  if (brightness > 228) return ["白色", "white"];
  if (hue >= 250 && hue <= 315) return ["紫色", "purple", "violet", "magenta"];
  if (hue >= 190 && hue < 250) return ["蓝色", "blue", "cyan"];
  if (hue >= 330 || hue < 10) return ["红色", "red", "pink"];
  if (hue >= 10 && hue < 45) return ["橙色", "orange", "coral"];
  if (hue >= 45 && hue < 70) return ["黄色", "yellow", "gold"];
  if (hue >= 70 && hue < 160) return ["绿色", "green", "lime"];
  if (hue >= 160 && hue < 190) return ["青色", "cyan", "teal"];
  return ["灰色", "gray"];
}

const NAMED_COLORS: Record<string, string[]> = {
  red: ["红色", "red"], orange: ["橙色", "orange"], yellow: ["黄色", "yellow"],
  green: ["绿色", "green"], blue: ["蓝色", "blue"], purple: ["紫色", "purple"],
  pink: ["粉色", "pink"], black: ["黑色", "black"], white: ["白色", "white"],
  gray: ["灰色", "gray"], grey: ["灰色", "grey"], cyan: ["青色", "cyan"],
  teal: ["青色", "teal"], magenta: ["紫色", "magenta"], violet: ["紫色", "violet"],
  lime: ["绿色", "lime"], coral: ["橙色", "coral"], gold: ["金色", "gold"],
  silver: ["银色", "silver"], brown: ["棕色", "brown"]
};

/**
 * 分析 CSS 中的颜色分布，返回主色、辅色、是否暗色、是否渐变、以及所有颜色标签。
 * 权重规则：background(3) > color(2) > border(1.5) > shadow/fill(0.8~1) > gradient-stop(1)
 */
export function analyzeColors(css: string): ColorFacet {
  const counts = new Map<string, { weight: number; rgb: string }>();
  let isGradient = false;

  const colorProps = [
    { names: ["background", "background-color"], weight: 3 },
    { names: ["color"], weight: 2 },
    { names: ["border", "border-color", "border-top-color", "border-bottom-color", "border-left-color", "border-right-color"], weight: 1.5 },
    { names: ["box-shadow", "text-shadow"], weight: 0.8 },
    { names: ["fill", "stroke"], weight: 1 }
  ];

  for (const { names, weight } of colorProps) {
    const pattern = new RegExp(`(?:${names.join("|")})\\s*:\\s*([^;]+)`, "gi");
    for (const match of css.matchAll(pattern)) {
      const value = match[1];
      if (!value) continue;
      const parsed = parseColor(value);
      if (parsed) {
        const key = `${parsed.r},${parsed.g},${parsed.b}`;
        const existing = counts.get(key);
        counts.set(key, { weight: (existing?.weight ?? 0) + weight, rgb: key });
      }
    }
  }

  for (const match of css.matchAll(/linear-gradient\(([^)]+)\)/gi)) {
    const gradientBody = match[1];
    if (!gradientBody) continue;
    isGradient = true;
    const stops = gradientBody.split(/,(?![^(]*\))/);
    for (const stop of stops) {
      const colorPart = stop.trim().replace(/^\d+%\s*/, "").trim();
      const parsed = parseColor(colorPart);
      if (parsed) {
        const key = `${parsed.r},${parsed.g},${parsed.b}`;
        const existing = counts.get(key);
        counts.set(key, { weight: (existing?.weight ?? 0) + 1, rgb: key });
      }
    }
  }

  for (const [name, labels] of Object.entries(NAMED_COLORS)) {
    const re = new RegExp(`\\b${name}\\b`, "gi");
    if (re.test(css)) {
      for (const label of labels) {
        counts.set(`named:${name}:${label}`, { weight: 1.5, rgb: "" });
      }
    }
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 5);

  const allTraits: string[] = [];
  let primary = "多彩";
  let isDark = false;

  for (const [key] of sorted) {
    if (key.startsWith("named:")) {
      const label = key.split(":")[2];
      if (label) allTraits.push(label);
      continue;
    }
    const [r, g, b] = key.split(",").map(Number);
    if (r === undefined || g === undefined || b === undefined) continue;
    const hue = rgbToHue({ r, g, b });
    const brightness = (r + g + b) / 3;
    allTraits.push(...hueToTraits(hue, brightness));
    if (sorted[0]?.[0] === key) {
      primary = hueToTraits(hue, brightness)[0] ?? primary;
      isDark = brightness < 80;
    }
  }

  const uniqueTraits = [...new Set([...allTraits, ...(isGradient ? ["渐变", "gradient"] : [])])];

  return {
    primary,
    secondary: uniqueTraits.filter((t) => t !== primary).slice(0, 4),
    isDark,
    isGradient,
    traits: uniqueTraits
  };
}

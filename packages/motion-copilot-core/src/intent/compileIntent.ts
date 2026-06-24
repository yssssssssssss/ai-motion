import {
  createClassicEasing,
  createSpringEasing,
  type MotionDocument,
  type MotionDirection,
  type MotionDocumentPatch,
  type MotionRole,
  type MotionTrigger
} from "../schema/document";

type CompileIntentInput = {
  prompt: string;
  base?: MotionDocument;
};

function roleFromPrompt(prompt: string): MotionRole {
  if (/toast|提示|轻提示|成功|保存/i.test(prompt)) return "toast";
  if (/button|按钮|点击|按压/i.test(prompt)) return "button";
  return "modal";
}

function triggerFromPrompt(prompt: string, role: MotionRole): MotionTrigger {
  if (/hover|悬停/.test(prompt)) return "hover";
  if (/click|点击|按压|按钮/.test(prompt)) return "click";
  return role === "button" ? "click" : "load";
}

function directionFromPrompt(prompt: string, role: MotionRole): MotionDirection {
  if (/退出|关闭|消失|离场|exit/.test(prompt)) return "exit-final";
  if (/移动|切换|move/.test(prompt)) return "move-inside";
  if (/临时|收起|退回/.test(prompt)) return "exit-temporary";
  return role === "button" ? "move-inside" : "enter";
}

export function compileIntent(input: CompileIntentInput): MotionDocumentPatch {
  const prompt = input.prompt.toLowerCase();
  const role = roleFromPrompt(input.prompt);
  const size = /大|large/.test(prompt) ? "large" : /小|small/.test(prompt) ? "small" : "medium";
  const trigger = triggerFromPrompt(input.prompt, role);
  const direction = directionFromPrompt(input.prompt, role);
  const baseTimeline = { trigger, direction };

  if (/q弹|弹性|回弹|活泼|spring|\bq\b/.test(prompt)) {
    return {
      element: { role, size, initial: { y: role === "button" ? 0 : 18, scale: role === "button" ? 1 : 0.94 } },
      timeline: { ...baseTimeline, easing: createSpringEasing(), durationMs: role === "button" ? 160 : 280 }
    };
  }

  if (/快|fast|迅速/.test(prompt)) {
    return {
      element: { role, size },
      timeline: { ...baseTimeline, durationMs: role === "button" ? 120 : 180, easing: createClassicEasing("sharp") }
    };
  }

  if (/慢|舒缓|slow/.test(prompt)) {
    return {
      element: { role, size },
      timeline: { ...baseTimeline, durationMs: size === "large" ? 380 : 320, easing: createClassicEasing("standard") }
    };
  }

  if (/丝滑|高级|克制|smooth|calm/.test(prompt)) {
    return {
      element: { role, size, initial: { y: role === "button" ? 0 : 12, scale: role === "button" ? 1 : 0.98 } },
      timeline: { ...baseTimeline, durationMs: role === "button" ? 150 : 240, easing: createClassicEasing("decelerate") }
    };
  }

  if (/淡|fade/.test(prompt)) {
    return {
      element: { role, size, initial: { y: 0, scale: 1, opacity: 0, blur: 0 } },
      timeline: { ...baseTimeline, durationMs: 240, easing: createClassicEasing("standard") }
    };
  }

  return { element: { role, size }, timeline: baseTimeline };
}

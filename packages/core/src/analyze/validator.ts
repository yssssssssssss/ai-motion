import type { MotionParam } from "../manifest/types";
import type { MotionSource } from "../library/componentLibrary";

export type ValidationResult = {
  confirmed: MotionParam[];
  rejected: MotionParam[];
  warnings: string[];
};

function dataMotionSelectorValue(selector: string): string | null {
  return selector.match(/^\[data-motion=([^\]]+)\]$/)?.[1]?.replace(/^["']|["']$/g, "") ?? null;
}

function targetExists(source: MotionSource, param: MotionParam): boolean {
  return param.targets.every((target) => {
    if (!("file" in target)) return true;

    const file = source.files.find((item) => item.path === target.file);
    if (!file) return false;

    if (target.kind === "css-variable") return file.content.includes(target.name);

    if (target.kind === "html-text") {
      const dataMotion = dataMotionSelectorValue(target.selector);
      if (!dataMotion) return true;

      return file.content.includes(`data-motion="${dataMotion}"`) || file.content.includes(`data-motion='${dataMotion}'`);
    }

    return true;
  });
}

export function confirmValidParams(input: { source: MotionSource; params: MotionParam[] }): ValidationResult {
  const confirmed: MotionParam[] = [];
  const rejected: MotionParam[] = [];
  const warnings: string[] = [];

  for (const param of input.params) {
    if (targetExists(input.source, param)) {
      confirmed.push({ ...param, status: "confirmed" });
    } else {
      rejected.push({ ...param, status: "rejected" });
      warnings.push(`Param ${param.id} has a missing target.`);
    }
  }

  return { confirmed, rejected, warnings };
}

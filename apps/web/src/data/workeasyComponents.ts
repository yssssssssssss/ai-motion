import { convertWorkEasyComponent, type MotionComponent, type WorkEasySkip } from "@motion-tool/core";
import { generatedWorkEasyRecords } from "./workeasyComponents.generated";

// 把同步的 convert 改成懒执行，让 Vite 把 generated 数据拆出独立 chunk
let conversionResults: ReturnType<typeof convertWorkEasyComponent>[] | null = null;

function ensureConversion(): ReturnType<typeof convertWorkEasyComponent>[] {
  if (conversionResults) return conversionResults;
  conversionResults = generatedWorkEasyRecords.map((input) => convertWorkEasyComponent(input));
  return conversionResults;
}

export const workEasyComponents: MotionComponent[] = (() =>
  ensureConversion().flatMap((result) => (result.ok ? [result.component] : [])))();

export const workEasySkippedComponents: WorkEasySkip[] = (() =>
  ensureConversion().flatMap((result) => (result.ok ? [] : [result.skip])))();

export const workEasyRecordCount = generatedWorkEasyRecords.length;
export const workEasyComponentCount = workEasyComponents.length;

import { convertWorkEasyComponent, type MotionComponent } from "@motion-tool/core";
import { generatedWorkEasyRecords } from "./workeasyComponents.generated";

export const workEasyComponents: MotionComponent[] = generatedWorkEasyRecords.flatMap((input) => {
  const result = convertWorkEasyComponent(input);
  return result.ok ? [result.component] : [];
});

export const workEasyComponentCount = workEasyComponents.length;

import type { WorkEasyCategory } from "./types";

export type WorkEasySelection = Record<WorkEasyCategory, string[]>;

function numberedIds(count: number, suffix: string): string[] {
  return Array.from({ length: count }, (_item, index) => `${index + 1}-${suffix}`);
}

export const selectedWorkEasyComponents: WorkEasySelection = {
  buttons: numberedIds(50, "button"),
  cards: numberedIds(20, "cards"),
  checkboxes: numberedIds(50, "checkbox")
};

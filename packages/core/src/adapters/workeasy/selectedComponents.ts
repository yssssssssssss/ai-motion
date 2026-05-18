import type { WorkEasyCategory } from "./types";

export type WorkEasySelection = Record<WorkEasyCategory, string[]>;

export const selectedWorkEasyComponents: WorkEasySelection = {
  buttons: [
    "1-button",
    "2-button",
    "3-button",
    "11-button",
    "12-button",
    "13-button",
    "14-button",
    "15-button",
    "20-button",
    "21-button"
  ],
  cards: ["1-cards", "2-cards", "3-cards", "4-cards", "5-cards"],
  checkboxes: ["1-checkbox", "2-checkbox", "3-checkbox", "4-checkbox", "5-checkbox"]
};

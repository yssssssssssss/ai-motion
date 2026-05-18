import { convertWorkEasyComponent, type MotionComponent, type WorkEasyComponentRecord } from "@motion-tool/core";

const records: Array<{ category: "buttons" | "cards" | "checkboxes"; record: WorkEasyComponentRecord }> = [
  {
    category: "buttons",
    record: {
      id: "1-button",
      title: "Save Button",
      type: "html",
      framework: "vanilla",
      tags: ["button", "hover", "workeasy"],
      htmlContent: '<div class="comp-1-button-container"><button class="bookmarkBtn"><span class="text">Save</span></button></div>',
      cssContent:
        ".comp-1-button-container .bookmarkBtn { color: #ffffff; background-color: rgb(12,12,12); transition-duration: 0.3s; border-radius: 40px; }"
    }
  },
  {
    category: "cards",
    record: {
      id: "1-cards",
      title: "Hover Card",
      type: "html",
      framework: "vanilla",
      tags: ["card", "hover", "workeasy"],
      htmlContent: '<div class="workeasy-card"><h3>Motion Card</h3><p>Hover to inspect.</p></div>',
      cssContent:
        ".workeasy-card { color: #111827; background-color: #ffffff; transition-duration: 0.25s; border-radius: 18px; } .workeasy-card:hover { transform: translateY(-6px); }"
    }
  },
  {
    category: "checkboxes",
    record: {
      id: "1-checkbox",
      title: "Animated Checkbox",
      type: "html",
      framework: "vanilla",
      tags: ["checkbox", "form", "workeasy"],
      htmlContent: '<label class="workeasy-checkbox"><input type="checkbox" /><span>Enable motion</span></label>',
      cssContent:
        ".workeasy-checkbox { color: #0f172a; transition-duration: 0.2s; } .workeasy-checkbox span { border-radius: 8px; background-color: #e2e8f0; }"
    }
  }
];

export const workEasyComponents: MotionComponent[] = records.flatMap((input) => {
  const result = convertWorkEasyComponent(input);
  return result.ok ? [result.component] : [];
});

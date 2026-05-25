import { describe, expect, it } from "vitest";
import { createSearchProfile } from "../src/orchestrator/searchProfile";
import type { MotionComponent } from "../src/library/componentLibrary";

const component = {
  id: "campaign-cta",
  name: "Campaign CTA Button",
  category: "interaction",
  tags: ["button", "cta", "workeasy"],
  useCases: ["campaign-page", "landing-page"],
  moods: ["tech", "expressive"],
  manifest: {
    id: "campaign-cta",
    name: "Campaign CTA Button",
    params: [
      {
        id: "label",
        label: "Button label",
        type: "text",
        status: "confirmed",
        default: "Join now",
        targets: []
      },
      {
        id: "duration",
        label: "Hover duration",
        type: "duration",
        status: "confirmed",
        default: "300ms",
        targets: []
      }
    ]
  },
  source: {
    id: "campaign-cta",
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      {
        path: "source/index.html",
        kind: "html",
        content: '<button class="cta">Join now</button>'
      },
      {
        path: "source/style.css",
        kind: "css",
        content:
          ".cta { background: linear-gradient(90deg, #6B36FA, #3544EB); transition: transform 300ms; } .cta:hover { transform: scale(1.08); box-shadow: 0 0 20px #8F55FD; }"
      }
    ]
  }
} as unknown as MotionComponent;

describe("createSearchProfile", () => {
  it("extracts color, motion, function, scene, and editable traits", () => {
    const profile = createSearchProfile(component);

    expect(profile.colorTraits).toEqual(expect.arrayContaining(["紫色", "蓝色", "渐变"]));
    expect(profile.motionTraits).toEqual(expect.arrayContaining(["hover", "scale", "glow"]));
    expect(profile.functionTraits).toEqual(expect.arrayContaining(["按钮", "CTA"]));
    expect(profile.sceneTraits).toEqual(expect.arrayContaining(["活动页", "落地页"]));
    expect(profile.editableTraits).toEqual(expect.arrayContaining(["Button label", "Hover duration"]));
    expect(profile.rawText).toContain("Join now");
  });
});

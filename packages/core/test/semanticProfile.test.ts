import { describe, expect, it } from "vitest";
import {
  createComponentSemanticProfile,
  createQuerySemanticProfile
} from "../src/orchestrator/semanticProfile";
import type { MotionComponent } from "../src/library/componentLibrary";
import type { ParsedBriefIntent } from "../src/orchestrator/briefIntent";

const component = {
  id: "campaign-glow-button",
  name: "Campaign Glow Button",
  category: "interaction",
  tags: ["button", "cta", "workeasy"],
  useCases: ["campaign-page", "landing-page"],
  moods: ["tech", "expressive"],
  manifest: {
    id: "campaign-glow-button",
    name: "Campaign Glow Button",
    params: [
      {
        id: "label",
        label: "Button label",
        type: "text",
        status: "confirmed",
        default: "Join now",
        targets: []
      }
    ]
  },
  source: {
    id: "campaign-glow-button",
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

describe("semantic profiles", () => {
  it("builds a structured component profile from metadata, source analysis, and manifest", () => {
    const profile = createComponentSemanticProfile(component);

    expect(profile.role).toBe("button");
    expect(profile.scenes).toEqual(expect.arrayContaining(["活动页", "落地页"]));
    expect(profile.intents).toEqual(expect.arrayContaining(["转化", "反馈"]));
    expect(profile.motion.triggers).toContain("hover");
    expect(profile.motion.primitives).toEqual(expect.arrayContaining(["scale", "glow"]));
    expect(profile.visual.colors).toEqual(expect.arrayContaining(["紫色", "蓝色"]));
    expect(profile.searchText).toContain("Campaign Glow Button");
    expect(profile.searchText).toContain("活动页");
  });

  it("builds a query profile with hard requirements separated from preferences", () => {
    const intent: ParsedBriefIntent = {
      query: "我想要一个适合活动页的紫色按钮 hover 发光动效",
      semanticQuery: "活动页 CTA 紫色按钮 hover 发光",
      categories: ["interaction"],
      componentKinds: ["button"],
      motionStyles: ["hover"],
      sources: [],
      keywords: [],
      softPreferences: ["活动页", "紫色", "发光"],
      hardConstraints: ["按钮"],
      negativePreferences: ["卡片"],
      reasoningHints: [],
      confidence: 0.9
    };

    const profile = createQuerySemanticProfile(intent);

    expect(profile.roles).toEqual(["button"]);
    expect(profile.scenes).toContain("活动页");
    expect(profile.motion.triggers).toContain("hover");
    expect(profile.motion.primitives).toContain("glow");
    expect(profile.visual.colors).toContain("紫色");
    expect(profile.must).toContain("按钮");
    expect(profile.mustNot).toContain("卡片");
  });
});

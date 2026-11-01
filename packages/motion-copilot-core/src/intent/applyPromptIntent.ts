import { applyDocumentPatch, createDefaultDocument } from "../schema/defaults";
import { primaryElement, type MotionDocument } from "../schema/document";
import { compileIntent } from "./compileIntent";

function sameData(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const a = Object.entries(left);
  const b = Object.entries(right);
  return (
    a.length === b.length &&
    a.every(([key, value]) => Object.hasOwn(right, key) && sameData(value, Reflect.get(right, key)))
  );
}

export function applyPromptIntent(document: MotionDocument, prompt: string): MotionDocument {
  const patch = compileIntent({ prompt, base: document });
  const role = primaryElement(document).role;
  const defaults = createDefaultDocument(role);
  const { guidelineSuggestions: _suggestions, ...content } = document;
  const { guidelineSuggestions: _defaults, ...defaultContent } = defaults;
  const canReplace =
    !document.visualSource &&
    ((document.layers.length === 0 && sameData(document.stage, defaults.stage)) ||
      sameData(content, defaultContent));

  if (!canReplace && patch.element?.role !== role) {
    // Background elements may be deliberately invisible proxies for imported visuals.
    // Template size/initial values must not make that primary element visible.
    if (role === "background") delete patch.element;
    else if (patch.element) delete patch.element.role;
  }
  return applyDocumentPatch(document, patch);
}

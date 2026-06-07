import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  ControlledGenerationPatch,
  GeneratedComponentValidationResult,
  GenerationPlan,
  MotionComponent
} from "@motion-tool/core";

const DEFAULT_MAX_BODY_BYTES = 50 * 1024 * 1024;

export type ControlledGenerationResponse = {
  component: MotionComponent;
  patch: ControlledGenerationPatch;
  validation: GeneratedComponentValidationResult;
  plan: GenerationPlan;
};

export type CreateControlledGenerationHandlerInput = {
  maxBodyBytes?: number;
};

function readBody(req: IncomingMessage, maxBodyBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxBodyBytes) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function isMotionComponent(value: unknown): value is MotionComponent {
  if (!value || typeof value !== "object") return false;
  const component = value as Partial<MotionComponent>;
  return (
    typeof component.id === "string" &&
    typeof component.name === "string" &&
    typeof component.manifest === "object" &&
    typeof component.source === "object" &&
    Array.isArray(component.source?.files)
  );
}

export function createControlledGenerationHandler(input: CreateControlledGenerationHandlerInput = {}) {
  const maxBodyBytes = input.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return async function controlledGenerationHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "POST") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const raw = await readBody(req, maxBodyBytes);
      const parsed = JSON.parse(raw || "{}") as { brief?: unknown; components?: unknown };
      if (typeof parsed.brief !== "string" || !Array.isArray(parsed.components)) {
        writeJson(res, 400, { error: "brief and components are required" });
        return;
      }

      const {
        buildControlledGenerationRequest,
        compileSemanticPatch,
        createGeneratedComponentFromPatch
      } = await import("@motion-tool/core");
      const components = parsed.components.filter(isMotionComponent);
      const request = buildControlledGenerationRequest({ brief: parsed.brief, components });
      const patch = compileSemanticPatch(request);
      const baseComponent = components.find((component) => component.id === patch.baseComponentId);
      const candidate = request.plan.candidates.find((item) => item.componentId === patch.baseComponentId);

      if (!baseComponent || !candidate) {
        writeJson(res, 422, { error: "没有可用于受控生成的候选组件", plan: request.plan });
        return;
      }

      const generated = createGeneratedComponentFromPatch({
        brief: request.brief,
        baseComponent,
        candidate,
        patch
      });

      const response: ControlledGenerationResponse = { ...generated, plan: request.plan };
      writeJson(
        res,
        generated.validation.valid ? 200 : 422,
        generated.validation.valid ? response : { ...response, error: "生成未通过门禁" }
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("too large")) {
        writeJson(res, 413, { error: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes("没有可用于受控生成")) {
        writeJson(res, 422, { error: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes("没有生成有效差异")) {
        writeJson(res, 422, { error: error.message });
        return;
      }

      writeJson(res, 500, {
        error: error instanceof Error ? error.message : "Failed to generate controlled component."
      });
    }
  };
}

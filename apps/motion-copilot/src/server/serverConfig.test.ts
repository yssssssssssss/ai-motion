import { describe, expect, it } from "vitest";
import { buildCopilotServerConfig } from "./serverConfig";

const SCRIPTS_DIR = "/repo/scripts";
const SNAPSHOT_SCRIPT = "/repo/scripts/zero-frame-snapshot-fixture.mjs";
const VISUAL_SCRIPT = "/repo/scripts/zero-visual-snapshot-fixture.mjs";
const LAYER_SCRIPT = "/repo/scripts/zero-layer-snapshot-fixture.mjs";
const MCP_LAYER_BRIDGE = "/repo/scripts/zero-mcp-layer-bridge.mjs";

function build(env: Record<string, string>) {
  return buildCopilotServerConfig(env, { scriptsDir: SCRIPTS_DIR });
}

describe("buildCopilotServerConfig", () => {
  describe("modelConfig", () => {
    it("reads OPENAI_* and defaults the model to gpt-5.5", () => {
      const { modelConfig } = build({ OPENAI_API_KEY: "k", OPENAI_BASE_URL: "https://api.test" });
      expect(modelConfig).toEqual({
        apiKey: "k",
        apiBaseUrl: "https://api.test",
        model: "gpt-5.5"
      });
    });

    it("honors an explicit generation model", () => {
      const { modelConfig } = build({ OPENAI_GENERATION_MODEL: "gpt-6" });
      expect(modelConfig.model).toBe("gpt-6");
    });

    it("includes modelTimeoutMs only when positive", () => {
      expect(build({ OPENAI_GENERATION_TIMEOUT_MS: "1500" }).modelConfig.modelTimeoutMs).toBe(1500);
      expect(build({ OPENAI_GENERATION_TIMEOUT_MS: "0" }).modelConfig).not.toHaveProperty("modelTimeoutMs");
      expect(build({}).modelConfig).not.toHaveProperty("modelTimeoutMs");
    });
  });

  describe("zeroConfig (frame snapshot)", () => {
    it("falls back to node + snapshot fixture with {nodeId} injected", () => {
      const { zeroConfig } = build({});
      expect(zeroConfig.snapshotCommand).toBe(process.execPath);
      expect(zeroConfig.snapshotArgs).toEqual([SNAPSHOT_SCRIPT, "--node-id", "{nodeId}"]);
      expect(zeroConfig.commandEnv).toEqual({});
    });

    it("honors an explicit command and appends {nodeId} when missing", () => {
      const { zeroConfig } = build({
        ZERO_MCP_SNAPSHOT_COMMAND: "/bin/snap",
        ZERO_MCP_SNAPSHOT_ARGS: "--flag value"
      });
      expect(zeroConfig.snapshotCommand).toBe("/bin/snap");
      expect(zeroConfig.snapshotArgs).toEqual(["--flag", "value", "--node-id", "{nodeId}"]);
    });

    it("keeps caller-provided {nodeId} placement untouched", () => {
      const { zeroConfig } = build({ ZERO_MCP_SNAPSHOT_ARGS: "bridge.mjs --node-id {nodeId} --json" });
      expect(zeroConfig.snapshotArgs).toEqual(["bridge.mjs", "--node-id", "{nodeId}", "--json"]);
    });

    it("includes timeoutMs only when positive", () => {
      expect(build({ ZERO_MCP_SNAPSHOT_TIMEOUT_MS: "800" }).zeroConfig.timeoutMs).toBe(800);
      expect(build({}).zeroConfig).not.toHaveProperty("timeoutMs");
    });
  });

  describe("zeroVisualConfig", () => {
    it("falls back to node + visual fixture with {nodeId} injected", () => {
      const { zeroVisualConfig } = build({});
      expect(zeroVisualConfig.visualCommand).toBe(process.execPath);
      expect(zeroVisualConfig.visualArgs).toEqual([VISUAL_SCRIPT, "--node-id", "{nodeId}"]);
    });

    it("includes timeoutMs only when positive", () => {
      expect(build({ ZERO_MCP_VISUAL_TIMEOUT_MS: "900" }).zeroVisualConfig.timeoutMs).toBe(900);
      expect(build({}).zeroVisualConfig).not.toHaveProperty("timeoutMs");
    });
  });

  describe("zeroLayerConfig", () => {
    it("uses the local layer fixture when no MCP http url is configured", () => {
      const { zeroLayerConfig } = build({});
      expect(zeroLayerConfig.layerCommand).toBe(process.execPath);
      expect(zeroLayerConfig.layerArgs).toEqual([LAYER_SCRIPT, "--node-id", "{nodeId}"]);
    });

    it("switches to the MCP layer bridge when ZERO_MCP_HTTP_URL is present", () => {
      const { zeroLayerConfig } = build({ ZERO_MCP_HTTP_URL: "http://example.test/mcp" });
      expect(zeroLayerConfig.layerArgs).toEqual([MCP_LAYER_BRIDGE, "--node-id", "{nodeId}"]);
    });

    it("includes timeoutMs only when positive", () => {
      expect(build({ ZERO_MCP_LAYER_TIMEOUT_MS: "700" }).zeroLayerConfig.timeoutMs).toBe(700);
      expect(build({}).zeroLayerConfig).not.toHaveProperty("timeoutMs");
    });
  });

  describe("zeroLayerFramePairConfig", () => {
    it("always targets the MCP layer bridge with the discovery flag", () => {
      const { zeroLayerFramePairConfig } = build({});
      expect(zeroLayerFramePairConfig.discoveryCommand).toBe(process.execPath);
      expect(zeroLayerFramePairConfig.discoveryArgs).toEqual([MCP_LAYER_BRIDGE, "--discover-frame-pairs"]);
    });

    it("strips node-id args and appends the discovery flag when custom layer args exist", () => {
      const { zeroLayerFramePairConfig } = build({
        ZERO_MCP_LAYER_ARGS: "custom-bridge.mjs --node-id {nodeId}"
      });
      expect(zeroLayerFramePairConfig.discoveryArgs).toEqual(["custom-bridge.mjs", "--discover-frame-pairs"]);
    });

    it("shares the layer command and timeout with zeroLayerConfig", () => {
      const { zeroLayerFramePairConfig } = build({
        ZERO_MCP_LAYER_COMMAND: "/bin/layer",
        ZERO_MCP_LAYER_TIMEOUT_MS: "650"
      });
      expect(zeroLayerFramePairConfig.discoveryCommand).toBe("/bin/layer");
      expect(zeroLayerFramePairConfig.timeoutMs).toBe(650);
    });
  });

  describe("zeroAssetConfig", () => {
    it("defaults to an empty allow list", () => {
      expect(build({}).zeroAssetConfig.allowedOrigins).toEqual([]);
    });

    it("prepends the MCP http url and splits the configured origins without trimming values", () => {
      const { zeroAssetConfig } = build({
        ZERO_MCP_HTTP_URL: "http://example.test/mcp",
        ZERO_ASSET_ALLOWED_ORIGINS: "https://a.test, https://b.test"
      });
      expect(zeroAssetConfig.allowedOrigins).toEqual([
        "http://example.test/mcp",
        "https://a.test",
        " https://b.test"
      ]);
    });

    it("includes maxResponseBytes only when positive", () => {
      expect(build({ ZERO_ASSET_MAX_BYTES: "2048" }).zeroAssetConfig.maxResponseBytes).toBe(2048);
      expect(build({}).zeroAssetConfig).not.toHaveProperty("maxResponseBytes");
    });
  });

  describe("shared Zero bridge env", () => {
    it("forwards ZERO_MCP_* vars to every bridge commandEnv", () => {
      const env = { ZERO_MCP_HTTP_URL: "http://example.test/mcp", ZERO_MCP_TOKEN: "t" };
      const config = build(env);
      const expected = { ZERO_MCP_HTTP_URL: "http://example.test/mcp", ZERO_MCP_TOKEN: "t" };
      expect(config.zeroConfig.commandEnv).toEqual(expected);
      expect(config.zeroVisualConfig.commandEnv).toEqual(expected);
      expect(config.zeroLayerConfig.commandEnv).toEqual(expected);
      expect(config.zeroLayerFramePairConfig.commandEnv).toEqual(expected);
    });
  });
});

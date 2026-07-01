#!/usr/bin/env tsx

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileZeroLayerMotionBindings,
  createZeroLayerDiagnosticReport,
  createZeroLayerRecipeSampleReport,
  normalizeZeroLayerSnapshot,
  zeroLayerMotionRecipes,
  type ZeroLayerDiagnosticReport,
  type ZeroLayerDiagnosticSource,
  type ZeroLayerMotionRecipeId,
  type ZeroLayerRecipeSampleReport,
  type ZeroLayerSnapshot
} from "../packages/motion-copilot-core/src";

type Args = Record<string, string | boolean>;

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function usage(): string {
  return `Usage:
  pnpm zero:diagnose --from <nodeId> --to <nodeId>
  pnpm zero:diagnose --from <nodeId> --to <nodeId> --fixture
  pnpm zero:diagnose --from-file <from.json> --to-file <to.json>

Options:
  --pretty             Print a compact human-readable report instead of JSON.
  --out <path>         Write the report to a file.
  --duration-ms <ms>   Override the base motion duration.
  --fail-on <level>    Exit non-zero when risks include warning or error.
  --recipe-samples     Output deterministic Zero native recipe sampling report.
  --recipe <id>        Restrict --recipe-samples to one recipe id.

Environment:
  ZERO_MCP_HTTP_URL                         Used by scripts/zero-mcp-layer-bridge.mjs.
  ZERO_LAYER_DIAGNOSE_SNAPSHOT_COMMAND      Optional command template with {nodeId}.`;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--")) continue;
    if (value == null || value.startsWith("--")) {
      args[key.slice(2)] = true;
      continue;
    }
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

function stringArg(args: Args, name: string): string | undefined {
  const value = args[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function splitCommand(value: string): string[] {
  return (
    value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((item) => item.replace(/^(['"])(.*)\1$/, "$2")) ?? []
  );
}

function snapshotCommand(
  nodeId: string,
  args: Args
): { command: string; args: string[]; bridge: string; source: ZeroLayerDiagnosticSource } {
  const template = process.env.ZERO_LAYER_DIAGNOSE_SNAPSHOT_COMMAND?.trim();
  if (template) {
    const [command, ...commandArgs] = splitCommand(template).map((part) =>
      part.replaceAll("{nodeId}", nodeId)
    );
    if (!command) throw new Error("ZERO_LAYER_DIAGNOSE_SNAPSHOT_COMMAND is empty.");
    return {
      command,
      args: commandArgs,
      bridge: template,
      source: "custom-command"
    };
  }

  if (args.fixture === true) {
    const script = resolve(repoRoot, "scripts/zero-layer-snapshot-fixture.mjs");
    return {
      command: process.execPath,
      args: [script, "--node-id", nodeId],
      bridge: "node scripts/zero-layer-snapshot-fixture.mjs --node-id {nodeId}",
      source: "fixture"
    };
  }

  const script = resolve(repoRoot, "scripts/zero-mcp-layer-bridge.mjs");
  return {
    command: process.execPath,
    args: [script, "--node-id", nodeId],
    bridge: "node scripts/zero-mcp-layer-bridge.mjs --node-id {nodeId}",
    source: process.env.ZERO_MCP_HTTP_URL ? "real-zero-mcp-http" : "zero-layer-bridge"
  };
}

async function execJson(command: string, args: string[]): Promise<unknown> {
  return new Promise((resolveJson, reject) => {
    execFile(command, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      try {
        resolveJson(JSON.parse(stdout));
      } catch (parseError) {
        reject(
          new Error(
            `Snapshot command did not return JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
          )
        );
      }
    });
  });
}

async function readSnapshotFile(path: string): Promise<ZeroLayerSnapshot> {
  return normalizeZeroLayerSnapshot(JSON.parse(await readFile(resolve(process.cwd(), path), "utf8")));
}

async function readSnapshotByNodeId(
  nodeId: string,
  args: Args
): Promise<{ snapshot: ZeroLayerSnapshot; bridge: string; source: ZeroLayerDiagnosticSource }> {
  const command = snapshotCommand(nodeId, args);
  const raw = await execJson(command.command, command.args);
  return {
    snapshot: normalizeZeroLayerSnapshot(raw),
    bridge: command.bridge,
    source: command.source
  };
}

function riskSummary(report: ZeroLayerDiagnosticReport): string {
  const counts = report.risks.reduce(
    (bucket, risk) => {
      bucket[risk.severity] += 1;
      return bucket;
    },
    { error: 0, warning: 0, info: 0 }
  );
  return `${counts.error} error, ${counts.warning} warning, ${counts.info} info`;
}

function sampleRiskSummary(report: ZeroLayerRecipeSampleReport): string {
  const counts = report.risks.reduce(
    (bucket, risk) => {
      bucket[risk.severity] += 1;
      return bucket;
    },
    { error: 0, warning: 0 }
  );
  return `${counts.error} error, ${counts.warning} warning`;
}

function formatPretty(report: ZeroLayerDiagnosticReport): string {
  const capabilities = report.styleCapabilities
    .filter((item) => item.count > 0 || item.status === "unsupported")
    .map((item) => `- ${item.capability}: ${item.status} (${item.count})`)
    .join("\n");
  const risks = report.risks.length
    ? report.risks
        .map(
          (risk) =>
            `- [${risk.severity}] ${risk.code}${risk.nodeId ? ` ${risk.nodeId}` : ""}: ${risk.message}`
        )
        .join("\n")
    : "- none";
  const recommendations = report.recommendations.length
    ? report.recommendations.map((item) => `- ${item.code}: ${item.message}`).join("\n")
    : "- none";
  const gateActions = report.gate.actions.length
    ? report.gate.actions.map((item) => `- ${item.code}: ${item.message}`).join("\n")
    : "- none";

  return [
    `Zero Layer Diagnostic (${report.schemaVersion})`,
    "",
    `Read: ${report.read.fromName} (${report.read.fromNodeId}, ${report.read.fromLayerCount} layers) -> ${report.read.toName} (${report.read.toNodeId}, ${report.read.toLayerCount} layers)`,
    `Source: ${report.read.source}${report.read.bridge ? ` via ${report.read.bridge}` : ""}`,
    `Matching: ${report.matching.matched} matched, ${report.matching.enter} enter, ${report.matching.exit} exit, ${report.matching.unresolved} unresolved`,
    `Motion: ${report.motion.durationMs}ms; matched=${report.motion.matched.length}, enter=${report.motion.enter.length}, exit=${report.motion.exit.length}`,
    `Risks: ${riskSummary(report)}`,
    "",
    "Quality Gate:",
    `- status=${report.gate.status}; pass=${report.gate.pass}; strategy=${report.gate.strategy}; score=${report.gate.score}`,
    `- ${report.gate.summary}`,
    report.gate.reasons.length ? `- reasons: ${report.gate.reasons.join(", ")}` : "- reasons: none",
    "Gate Actions:",
    gateActions,
    "",
    "Style Capabilities:",
    capabilities || "- none",
    "",
    "Risks:",
    risks,
    "",
    "Recommendations:",
    recommendations
  ].join("\n");
}

function formatRecipeSamplesPretty(report: ZeroLayerRecipeSampleReport): string {
  const recipes = report.recipes
    .map(
      (recipe) =>
        `- ${recipe.label} (${recipe.recipeId}): ${recipe.durationMs}ms, ${recipe.samples.length} samples, ${recipe.risks.length} risks`
    )
    .join("\n");
  const risks = report.risks.length
    ? report.risks
        .map((risk) => `- [${risk.severity}] ${risk.code}${risk.recipeId ? ` ${risk.recipeId}` : ""}: ${risk.message}`)
        .join("\n")
    : "- none";

  return [
    `Zero Layer Recipe Samples (${report.schemaVersion})`,
    "",
    `Samples: ${report.samplePoints.join(", ")}`,
    `Recipes: ${report.comparison.recipeCount}; distinct=${report.comparison.distinctSignatures}`,
    `Risks: ${sampleRiskSummary(report)}`,
    "",
    "Recipes:",
    recipes || "- none",
    "",
    "Risks:",
    risks
  ].join("\n");
}

function shouldFailDiagnostic(report: ZeroLayerDiagnosticReport, failOn: string | undefined): boolean {
  if (!failOn) return false;
  if (failOn !== "warning" && failOn !== "error") {
    throw new Error("--fail-on must be warning or error for diagnostic reports.");
  }
  return report.risks.some((risk) =>
    failOn === "warning"
      ? risk.severity === "warning" || risk.severity === "error"
      : risk.severity === "error"
  );
}

function shouldFailRecipeSamples(report: ZeroLayerRecipeSampleReport, failOn: string | undefined): boolean {
  if (!failOn) return false;
  if (failOn === "recipe-diff") return report.risks.some((risk) => risk.code === "RECIPE_DIFF_TOO_SMALL");
  if (failOn !== "warning" && failOn !== "error") {
    throw new Error("--fail-on must be warning, error, or recipe-diff for recipe sample reports.");
  }
  return report.risks.some((risk) =>
    failOn === "warning"
      ? risk.severity === "warning" || risk.severity === "error"
      : risk.severity === "error"
  );
}

function recipeIdsArg(value: string | undefined): ZeroLayerMotionRecipeId[] | undefined {
  if (!value) return undefined;
  const available = new Set(zeroLayerMotionRecipes.map((recipe) => recipe.id));
  const ids = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const unknown = ids.filter((id) => !available.has(id as ZeroLayerMotionRecipeId));
  if (unknown.length > 0) {
    throw new Error(`Unknown --recipe value: ${unknown.join(", ")}.`);
  }
  return ids as ZeroLayerMotionRecipeId[];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === true || args.h === true) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const fromFile = stringArg(args, "from-file");
  const toFile = stringArg(args, "to-file");
  const fromNodeId = stringArg(args, "from");
  const toNodeId = stringArg(args, "to");
  const durationArg = stringArg(args, "duration-ms");
  const failOn = stringArg(args, "fail-on");
  const recipeSamples = args["recipe-samples"] === true;
  const recipeIds = recipeIdsArg(stringArg(args, "recipe"));
  const durationMs = durationArg == null ? undefined : Number(durationArg);
  if (durationMs != null && (!Number.isFinite(durationMs) || durationMs <= 0)) {
    throw new Error("--duration-ms must be a positive number.");
  }

  let from: ZeroLayerSnapshot;
  let to: ZeroLayerSnapshot;
  let source: ZeroLayerDiagnosticSource = "unknown";
  let bridge: string | undefined;

  if (fromFile || toFile) {
    if (!fromFile || !toFile)
      throw new Error("--from-file and --to-file must be used together.\n\n" + usage());
    from = await readSnapshotFile(fromFile);
    to = await readSnapshotFile(toFile);
    source = "fixture";
    bridge = "file";
  } else {
    if (!fromNodeId || !toNodeId)
      throw new Error(
        "--from and --to are required unless --from-file and --to-file are provided.\n\n" + usage()
      );
    const fromResult = await readSnapshotByNodeId(fromNodeId, args);
    const toResult = await readSnapshotByNodeId(toNodeId, args);
    from = fromResult.snapshot;
    to = toResult.snapshot;
    source = fromResult.source === toResult.source ? fromResult.source : "custom-command";
    bridge =
      fromResult.bridge === toResult.bridge ? fromResult.bridge : `${fromResult.bridge}; ${toResult.bridge}`;
  }

  const report = createZeroLayerDiagnosticReport({
    from,
    to,
    source,
    ...(bridge ? { bridge } : {}),
    ...(durationMs ? { durationMs } : {})
  });
  if (recipeSamples) {
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const sampleReport = createZeroLayerRecipeSampleReport(
      {
        kind: "zero-layer-morph",
        from,
        to,
        bindingResult,
        diagnosticReport: report
      },
      { ...(recipeIds ? { recipeIds } : {}) }
    );
    const output =
      args.pretty === true ? formatRecipeSamplesPretty(sampleReport) : JSON.stringify(sampleReport, null, 2);
    const outPath = stringArg(args, "out");
    if (outPath) {
      await writeFile(resolve(process.cwd(), outPath), `${output}\n`);
      process.stdout.write(`Wrote ${resolve(process.cwd(), outPath)}\n`);
      if (shouldFailRecipeSamples(sampleReport, failOn)) process.exitCode = 2;
      return;
    }
    process.stdout.write(`${output}\n`);
    if (shouldFailRecipeSamples(sampleReport, failOn)) process.exitCode = 2;
    return;
  }
  const output = args.pretty === true ? formatPretty(report) : JSON.stringify(report, null, 2);
  const outPath = stringArg(args, "out");
  if (outPath) {
    await writeFile(resolve(process.cwd(), outPath), `${output}\n`);
    process.stdout.write(`Wrote ${resolve(process.cwd(), outPath)}\n`);
    if (shouldFailDiagnostic(report, failOn)) process.exitCode = 2;
    return;
  }
  process.stdout.write(`${output}\n`);
  if (shouldFailDiagnostic(report, failOn)) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

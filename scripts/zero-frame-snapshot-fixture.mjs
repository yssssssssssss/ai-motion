#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aliases = new Map([
  ["28:19", "info-collapsed.json"],
  ["28%3A19", "info-collapsed.json"],
  ["info-collapsed", "info-collapsed.json"],
  ["信息收起状态", "info-collapsed.json"],
  ["28:2", "info-expanded.json"],
  ["28%3A2", "info-expanded.json"],
  ["info-expanded", "info-expanded.json"],
  ["信息展开状态", "info-expanded.json"]
]);

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const nodeId = argValue("--node-id") || argValue("--nodeId");
if (!nodeId) {
  console.error("Usage: zero-frame-snapshot-fixture.mjs --node-id <nodeId>");
  process.exit(2);
}

const fileName = aliases.get(nodeId);
if (!fileName) {
  console.error(
    `No local FrameSnapshot fixture for nodeId "${nodeId}". Configure ZERO_MCP_SNAPSHOT_COMMAND to read real Zero MCP data.`
  );
  process.exit(1);
}

const repoRoot = resolve(fileURLToPath(import.meta.url), "../..");
const filePath = resolve(repoRoot, "fixtures/frames", fileName);
process.stdout.write(readFileSync(filePath, "utf8"));

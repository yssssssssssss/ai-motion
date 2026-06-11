import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { compileMotionSkillsFromRows, type MotionSkillLock } from "./compiler";

const ROOT = process.cwd();
const SOURCE_PATH = join(ROOT, "motion-source", "atomic-motion.csv");
const OUTPUT_DIR = join(ROOT, "motion-skills");
const LOCK_PATH = join(OUTPUT_DIR, "lock.json");

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
      continue;
    }
    cell += char;
  }

  cells.push(cell);
  return cells;
}

function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = parseCsvLine(lines[0] ?? "").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""]));
  });
}

function readLock(): MotionSkillLock | null {
  if (!existsSync(LOCK_PATH)) return null;
  return JSON.parse(readFileSync(LOCK_PATH, "utf8")) as MotionSkillLock;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function skillMarkdown(name: string, version: string): string {
  return `# ${name}\n\n版本: ${version}\n来源: motion-source/atomic-motion.csv\n\n该文件由 pnpm motion:compile 生成，请修改设计师 CSV 后重新编译。\n`;
}

if (!existsSync(SOURCE_PATH)) {
  throw new Error(`Missing designer CSV: ${SOURCE_PATH}`);
}

const rows = parseCsv(readFileSync(SOURCE_PATH, "utf8"));
const result = compileMotionSkillsFromRows({ rows, previousLock: readLock() });

mkdirSync(OUTPUT_DIR, { recursive: true });
writeJson(join(OUTPUT_DIR, "registry.json"), result.registry);
writeJson(LOCK_PATH, result.lock);

for (const [family, pack] of Object.entries(result.packs)) {
  const familyDir = join(OUTPUT_DIR, family);
  if (existsSync(familyDir)) rmSync(familyDir, { recursive: true, force: true });
  mkdirSync(familyDir, { recursive: true });
  writeJson(join(familyDir, "manifest.json"), pack.manifest);
  writeJson(join(familyDir, "tokens.json"), { tokens: pack.tokens });
  writeJson(join(familyDir, "recipes.json"), { recipes: pack.recipes });
  writeJson(join(familyDir, "previews.json"), { previews: [] });
  writeFileSync(join(familyDir, "skill.md"), skillMarkdown(pack.manifest.name, pack.manifest.version), "utf8");
}

writeFileSync(join(OUTPUT_DIR, "compile-report.md"), `${result.report}\n`, "utf8");
console.log(result.report);

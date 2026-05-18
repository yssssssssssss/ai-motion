import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const workEasyRoot = "/Users/heyunshen/work/PROJECT/jdc/jdc-WorkEasy";
const selection = {
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

async function readCategory(category) {
  const path = resolve(workEasyRoot, "public", "api", "components", `${category}.json`);
  const records = JSON.parse(await readFile(path, "utf8"));
  const byId = new Map(records.map((record) => [record.id, record]));

  return selection[category].map((id) => {
    const record = byId.get(id);
    if (!record) throw new Error(`Missing WorkEasy component ${category}/${id}`);
    if (record.type !== "html") throw new Error(`Unsupported WorkEasy component ${category}/${id}: ${record.type}`);
    if (!record.htmlContent || !record.cssContent) throw new Error(`Incomplete WorkEasy component ${category}/${id}`);
    return {
      category,
      record: {
        id: record.id,
        title: record.title,
        author: record.author,
        type: record.type,
        framework: record.framework,
        tags: record.tags,
        description: record.description,
        version: record.version,
        htmlContent: record.htmlContent,
        cssContent: record.cssContent,
        jsContent: record.jsContent
      }
    };
  });
}

const inputs = [
  ...(await readCategory("buttons")),
  ...(await readCategory("cards")),
  ...(await readCategory("checkboxes"))
];

const output = `import type { WorkEasyCategory, WorkEasyComponentRecord } from "@motion-tool/core";

export const generatedWorkEasyRecords: Array<{ category: WorkEasyCategory; record: WorkEasyComponentRecord }> = ${JSON.stringify(
  inputs,
  null,
  2
)};
`;

const target = resolve(repoRoot, "apps", "web", "src", "data", "workeasyComponents.generated.ts");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, output);
console.log(`Generated ${inputs.length} WorkEasy records at ${target}`);

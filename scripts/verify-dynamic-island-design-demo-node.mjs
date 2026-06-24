import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const componentRoot = resolve(repoRoot, "packages/components-builtin/dynamic-island-design-demo");
const sourceRoot = resolve(componentRoot, "source");
const viteBin = resolve(repoRoot, "apps/web/node_modules/vite/bin/vite.js");

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(viteBin)) {
  fail("Vite is missing. Install the web workspace dependencies before running this check.");
}

for (const fileName of ["index.html", "style.css", "script.js"]) {
  if (!existsSync(resolve(sourceRoot, fileName))) {
    fail(`Missing dynamic-island-design-demo source file: ${fileName}`);
  }
}

const tempRoot = mkdtempSync(resolve(tmpdir(), "dynamic-island-design-demo-"));

try {
  const srcRoot = resolve(tempRoot, "src");
  cpSync(sourceRoot, srcRoot, { recursive: true });

  const html = readFileSync(resolve(sourceRoot, "index.html"), "utf8")
    .replace("./style.css", "/src/styles.css")
    .replace("./script.js", "/src/main.js");

  writeFileSync(resolve(tempRoot, "index.html"), html);
  writeFileSync(resolve(tempRoot, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  cpSync(resolve(sourceRoot, "style.css"), resolve(srcRoot, "styles.css"));
  cpSync(resolve(sourceRoot, "script.js"), resolve(srcRoot, "main.js"));

  const result = spawnSync(process.execPath, [viteBin, "build", "--outDir", "dist", "--emptyOutDir"], {
    cwd: tempRoot,
    encoding: "utf8",
    stdio: "pipe"
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    fail("Dynamic island design demo failed to build through the Node/Vite restoration path.");
  }

  const builtHtml = resolve(tempRoot, "dist/index.html");
  if (!existsSync(builtHtml)) {
    fail("Dynamic island design demo Vite build did not emit dist/index.html.");
  }

  console.log("dynamic-island-design-demo Node/Vite restoration build passed.");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

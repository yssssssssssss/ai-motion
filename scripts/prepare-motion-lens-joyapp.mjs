import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(repoRoot, "apps/motion-lens");

execFileSync("pnpm", ["--filter", "@motion-lens/app", "build"], {
  cwd: repoRoot,
  stdio: "inherit"
});

const server = await readFile(join(appDir, "dist-server/startProductionServer.js"), "utf8");
const imports = [...server.matchAll(/^import\b[^;]*?from\s*["']([^"']+)["']/gm)];
if (imports.some(([, specifier]) => !specifier.startsWith("node:"))) {
  throw new Error("Motion Lens server has external imports; update its JoyApp packaging first.");
}

const releaseDir = await mkdtemp(join(tmpdir(), "motion-lens-joyapp-"));
const serverDir = join(releaseDir, "server");
await mkdir(serverDir);
await cp(join(appDir, "dist"), join(serverDir, "dist"), { recursive: true });
await writeFile(join(serverDir, "startProductionServer.mjs"), server);

// JoyApp injects a CommonJS guard beside main and retains main's directory.
// Keep that directory CommonJS; the existing business bundle stays ESM as .mjs.
await writeFile(
  join(serverDir, "index.js"),
  `process.chdir(__dirname);
import("./startProductionServer.mjs").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`
);

const manifest = {
  name: "ai-motion-lens-joyapp",
  version: "0.0.0",
  private: true,
  main: "server/index.js",
  engines: { node: "22.x" },
  scripts: { start: "node server/index.js" }
};
await writeFile(join(releaseDir, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
await writeFile(
  join(releaseDir, "package-lock.json"),
  JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": { name: manifest.name, version: manifest.version, engines: manifest.engines }
      }
    },
    null,
    2
  ) + "\n"
);

console.log(`JoyApp projectDir: ${releaseDir}`);

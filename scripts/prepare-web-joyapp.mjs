import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(repoRoot, "apps/web");
execFileSync("pnpm", ["--filter", "@motion-tool/web", "build"], {
  cwd: repoRoot,
  stdio: "inherit"
});

const releaseDir = await mkdtemp(join(tmpdir(), "ai-motion-web-joyapp-"));
await mkdir(join(releaseDir, "app"));
await cp(join(appDir, "dist"), join(releaseDir, "app/dist"), { recursive: true });
await cp(join(appDir, "dist-server"), join(releaseDir, "app/dist-server"), { recursive: true });
await writeFile(join(releaseDir, "app/package.json"), '{"type":"module"}\n');
// The injected platform guard is CommonJS; the business bundle remains ESM.
await writeFile(
  join(releaseDir, "index.js"),
  `process.chdir(__dirname + "/app");
import("./app/dist-server/startProductionServer.js").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`
);
await writeFile(
  join(releaseDir, "package.json"),
  JSON.stringify(
    {
      name: "ai-motion-web-joyapp",
      version: "0.0.0",
      private: true,
      main: "index.js",
      engines: { node: "22.x" },
      scripts: { start: "node index.js" }
    },
    null,
    2
  ) + "\n"
);
await writeFile(
  join(releaseDir, "Dockerfile"),
  `FROM node:22-bookworm-slim
RUN apt-get update \\
    && apt-get install -y --no-install-recommends ffmpeg \\
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
EXPOSE 8080
CMD ["node", "index.js"]
`
);
console.log(`JoyApp projectDir: ${releaseDir}`);

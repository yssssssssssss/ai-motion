import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "node_modules", ".cache", "motion-skill-compiler");
const tsconfigPath = join(outDir, "tsconfig.json");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "package.json"), '{"type":"commonjs"}\n', "utf8");
writeFileSync(
  join(outDir, "node-shims.d.ts"),
  `declare module "node:fs" {
  export const existsSync: any;
  export const mkdirSync: any;
  export const readFileSync: any;
  export const rmSync: any;
  export const writeFileSync: any;
}
declare module "node:path" {
  export const dirname: any;
  export const join: any;
}
declare const process: any;
declare const console: any;
`,
  "utf8"
);
writeFileSync(
  tsconfigPath,
  `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "CommonJS",
        moduleResolution: "Node",
        strict: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        skipLibCheck: true,
        types: [],
        rootDir: "../../../packages/core/src",
        outDir: "."
      },
      files: [
        "node-shims.d.ts",
        "../../../packages/core/src/motionSkill/cli.ts",
        "../../../packages/core/src/motionSkill/compiler.ts",
        "../../../packages/core/src/motionSkill/normalize.ts",
        "../../../packages/core/src/motionSkill/types.ts"
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

const compile = spawnSync("pnpm", ["exec", "tsc", "--project", tsconfigPath], {
  stdio: "inherit",
  shell: process.platform === "win32"
});
if ((compile.status ?? 1) !== 0) process.exit(compile.status ?? 1);

const cliPath = join(outDir, "motionSkill", "cli.js");
if (!existsSync(cliPath)) {
  console.error(`Compiled CLI not found: ${cliPath}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, [cliPath], { stdio: "inherit" });
process.exit(result.status ?? 1);

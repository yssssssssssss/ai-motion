import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { loadProductionEnv } from "./productionEnv";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

it("loads the cwd env file, with nonempty process values taking precedence", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "web-env-"));
  directories.push(cwd);
  await writeFile(
    join(cwd, ".env.local"),
    "# comment\n\ninvalid\nOPENAI_API_KEY=\"local-key\"\nOPENAI_BASE_URL='https://local.test/v1'\nOPENAI_GENERATION_MODEL=local-model\n"
  );
  expect(loadProductionEnv(cwd, { OPENAI_API_KEY: "process-key", OPENAI_BASE_URL: "" })).toMatchObject({
    OPENAI_API_KEY: "process-key",
    OPENAI_BASE_URL: "https://local.test/v1",
    OPENAI_GENERATION_MODEL: "local-model"
  });
});

it("accepts a missing file", () => {
  expect(loadProductionEnv(join(tmpdir(), "missing-web-env-directory"), { PORT: "4173" })).toEqual({
    PORT: "4173"
  });
});

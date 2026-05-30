import { resolve } from "node:path";
import { createProductionServer } from "./productionServer";

const host = process.env.HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "4173", 10);
const distDir = resolve(process.cwd(), "dist");

if (!Number.isFinite(port) || port <= 0) {
  throw new Error("PORT must be a positive number");
}

createProductionServer({ distDir }).listen(port, host, () => {
  console.log(`ai-motion web server listening on http://${host}:${port}`);
});

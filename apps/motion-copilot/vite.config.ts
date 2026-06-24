import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@motion-copilot/core": fileURLToPath(
        new URL("../../packages/motion-copilot-core/src/index.ts", import.meta.url)
      )
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5177,
    strictPort: true
  },
  preview: {
    host: "127.0.0.1",
    port: 5177,
    strictPort: true
  }
});

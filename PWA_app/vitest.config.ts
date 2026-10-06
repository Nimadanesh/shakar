import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // vitest has no "react-server" export condition, so the real
      // server-only package throws on import. Stub it in tests only —
      // production keeps the real enforcement.
      "server-only": path.resolve(__dirname, "./src/test-stubs/server-only.ts"),
    },
  },
});

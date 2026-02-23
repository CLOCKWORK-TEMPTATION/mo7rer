import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Set NODE_ENV to development for dev server
process.env.NODE_ENV = "development";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts", "src/**/*.tsx", "server/**/*.mjs"],
      exclude: ["src/main.tsx"],
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});

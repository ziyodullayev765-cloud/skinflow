import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    fileParallelism: false,
    environmentMatchGlobs: [["web/**", "jsdom"]],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "web/src/**/*.test.tsx"],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});

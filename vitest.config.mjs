import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    css: true,
    include: ["src/**/*.test.{js,jsx,ts,tsx}", "app/**/*.test.{ts,tsx}"],
  },
});

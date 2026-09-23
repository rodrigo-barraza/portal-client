import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/globalSetup.ts"],
    globals: true,
    passWithNoTests: true,
    // Agent worktrees live under .claude/worktrees — never collect their
    // copies of the suite when running from the main checkout.
    exclude: [...configDefaults.exclude, ".claude/**"],
    server: {
      deps: {
        // The library's dist imports its .module.css files, which Node
        // cannot load; let Vite process it so tests can render it.
        inline: ["@rodrigo-barraza/components-library"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});

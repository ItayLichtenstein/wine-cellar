import { defineConfig } from "vitest/config";

// Unit tests for pure logic (src/**/*.test.ts).
// Database rules are tested separately with pgTAP: `npm run test:db`.
export default defineConfig({
  resolve: { tsconfigPaths: true }, // understands the "@/..." imports
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

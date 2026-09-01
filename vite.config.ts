// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import path from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Server-side code (email routes, server functions) reads non-VITE_ env vars
// through process.env. Loaded here only for the server runtime — never added to
// client-side define, so secrets stay out of the browser bundle.
const serverEnv = loadEnv(process.env['NODE_ENV'] ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig({
  vite: {
    plugins: [mcpPlugin()],
    resolve: {
      alias: {
        // React Email pulls in `entities`; pin every import to the hoisted
        // v4.5.0 copy so SSR does not hit a nested v7 without ./lib/decode.js.
        "entities/lib/decode.js": path.resolve(import.meta.dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(import.meta.dirname, "node_modules/entities/lib/encode.js"),
        entities: path.resolve(import.meta.dirname, "node_modules/entities"),
      },
    },
  },
});

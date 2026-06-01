import { defineConfig } from "vite";

// Standalone front-end app. `public/` is served at the web root, so the
// datasets in `public/data/` are fetched at runtime from `/data/*.geojson`.
export default defineConfig({
  root: ".",
  // Relative base so the build works under any path — root domain, a GitHub
  // Pages subpath (/<repo>/), or a sub-folder — without rebuilding.
  base: "./",
  publicDir: "public",
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});

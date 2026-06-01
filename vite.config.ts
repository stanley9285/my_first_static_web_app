import { defineConfig } from "vite";

// Standalone front-end app. `public/` is served at the web root, so the
// datasets in `public/data/` are fetched at runtime from `/data/*.geojson`.
export default defineConfig({
  root: ".",
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

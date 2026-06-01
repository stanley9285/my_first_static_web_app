#!/usr/bin/env node
/**
 * build-data.mjs — reproducible boundary-data pipeline for the Malawi map.
 *
 * What it does:
 *   1. Downloads geoBoundaries ADM1 (regions) and ADM2 (districts) GeoJSON
 *      for Malawi (MWI) straight from the geoBoundaries release data on GitHub.
 *   2. Simplifies the geometry (Douglas–Peucker via Turf) so the files are
 *      small enough to ship and fast to render, while staying recognisable.
 *   3. Computes each district's parent region (ADM2 has no region link in its
 *      properties) using a point-in-polygon test on the district centroid, and
 *      bakes a `region` property into every district feature.
 *   4. Normalises properties to a stable schema (see src/types.ts) and writes
 *      the results to public/data/ where the app fetches them at runtime.
 *
 * Run with:  npm run data:build
 *
 * SOURCE / LICENSE: geoBoundaries (https://www.geoboundaries.org), Open
 * Database product, released CC-BY 4.0 — commercial use is permitted with
 * attribution. Citation: Runfola, D. et al. (2020) "geoBoundaries: A global
 * database of political administrative boundaries." PLoS ONE 15(4): e0231866.
 * See README.md "Licensing & Commercial Use".
 *
 * NOTE: the geoBoundaries release files are stored with Git LFS, so we fetch
 * them from the media.githubusercontent.com LFS endpoint (the raw. endpoint
 * returns the LFS pointer text, not the GeoJSON).
 */

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as turf from "@turf/turf";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "data");

const SOURCES = {
  adm1: {
    url: "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/MWI/ADM1/geoBoundaries-MWI-ADM1.geojson",
    out: "geoBoundaries-MWI-ADM1.geojson",
    // ADM1 has only 3 features; keep more detail (lower tolerance = more detail).
    tolerance: 0.002,
  },
  adm2: {
    url: "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/MWI/ADM2/geoBoundaries-MWI-ADM2.geojson",
    out: "geoBoundaries-MWI-ADM2.geojson",
    tolerance: 0.0025,
  },
};

async function fetchGeoJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.json();
}

function simplify(fc, tolerance) {
  // mutate=false to be safe; highQuality keeps topology reasonable for fills.
  return turf.simplify(fc, { tolerance, highQuality: true, mutate: false });
}

function bbox(feature) {
  return turf.bbox(feature); // [minX, minY, maxX, maxY]
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log("→ Downloading ADM1 (regions)…");
  const adm1Raw = await fetchGeoJSON(SOURCES.adm1.url);
  console.log("→ Downloading ADM2 (districts)…");
  const adm2Raw = await fetchGeoJSON(SOURCES.adm2.url);

  console.log("→ Simplifying…");
  const adm1 = simplify(adm1Raw, SOURCES.adm1.tolerance);
  const adm2 = simplify(adm2Raw, SOURCES.adm2.tolerance);

  // --- Normalise ADM1 (regions) ---
  adm1.features = adm1.features.map((f, i) => ({
    type: "Feature",
    id: i,
    properties: {
      id: f.properties.shapeID,
      name: f.properties.shapeName,
      level: "region",
      bbox: bbox(f),
    },
    geometry: f.geometry,
  }));

  // --- Normalise ADM2 (districts) + assign parent region ---
  // ADM2 properties carry no region link, so find the region whose polygon
  // contains the district's representative point (centroid clamped to polygon).
  adm2.features = adm2.features.map((f, i) => {
    const pt = turf.pointOnFeature(f); // guaranteed to sit inside the polygon
    let region = "Unknown";
    for (const r of adm1.features) {
      if (turf.booleanPointInPolygon(pt, r)) {
        region = r.properties.name;
        break;
      }
    }
    return {
      type: "Feature",
      id: i,
      properties: {
        id: f.properties.shapeID,
        name: f.properties.shapeName,
        level: "district",
        region,
        bbox: bbox(f),
      },
      geometry: f.geometry,
    };
  });

  const unknown = adm2.features.filter((f) => f.properties.region === "Unknown");
  if (unknown.length) {
    console.warn(
      `⚠ ${unknown.length} district(s) could not be matched to a region:`,
      unknown.map((f) => f.properties.name).join(", ")
    );
  }

  await writeFile(join(OUT_DIR, SOURCES.adm1.out), JSON.stringify(adm1));
  await writeFile(join(OUT_DIR, SOURCES.adm2.out), JSON.stringify(adm2));

  const sizeKb = (s) => Math.round(Buffer.byteLength(JSON.stringify(s)) / 1024);
  console.log(`✓ Wrote ${SOURCES.adm1.out} (${adm1.features.length} regions, ~${sizeKb(adm1)} KB)`);
  console.log(`✓ Wrote ${SOURCES.adm2.out} (${adm2.features.length} districts, ~${sizeKb(adm2)} KB)`);
  console.log("\nDistricts by region:");
  for (const r of adm1.features) {
    const ds = adm2.features.filter((d) => d.properties.region === r.properties.name);
    console.log(`  ${r.properties.name}: ${ds.length}`);
  }
  console.log(
    "\nNOTE: constituencies-MWI.geojson and landforms-MWI.geojson are NOT " +
      "generated here. Constituencies are licence-sensitive (scaffold only); " +
      "landforms are a curated set of factual natural features. See the README " +
      "'Licensing & Commercial Use' section and public/data/SOURCES.md."
  );
}

main().catch((err) => {
  console.error("✗ build-data failed:", err.message);
  process.exit(1);
});

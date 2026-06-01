/**
 * terrain.ts — 3D terrain + hillshade toggle.
 *
 * Adds a Terrarium-encoded DEM source (see config/basemap.ts → TERRAIN) and
 * uses it for both the 3D terrain mesh and a hillshade layer. Because the DEM
 * source/layers must be re-added whenever the basemap style is swapped (a style
 * change wipes user-added sources), `applyTerrain` is idempotent and is called
 * after every style load.
 */

import type { Map as MLMap } from "maplibre-gl";
import { TERRAIN } from "../config/basemap";

const HILLSHADE_LAYER = "terrain-hillshade";

function ensureDemSource(map: MLMap): void {
  if (map.getSource(TERRAIN.sourceId)) return;
  map.addSource(TERRAIN.sourceId, {
    type: "raster-dem",
    tiles: [...TERRAIN.tiles],
    encoding: TERRAIN.encoding,
    tileSize: TERRAIN.tileSize,
    maxzoom: TERRAIN.maxzoom,
    attribution: TERRAIN.attribution,
  });
}

function ensureHillshade(map: MLMap): void {
  if (map.getLayer(HILLSHADE_LAYER)) return;
  // Insert hillshade beneath symbol (label) layers so place names stay legible.
  const firstSymbol = map
    .getStyle()
    .layers?.find((l) => l.type === "symbol")?.id;
  map.addLayer(
    {
      id: HILLSHADE_LAYER,
      type: "hillshade",
      source: TERRAIN.sourceId,
      paint: { "hillshade-shadow-color": "#473b24" },
    },
    firstSymbol
  );
}

/**
 * Enable or disable terrain to match `on`. Safe to call repeatedly and after a
 * style reload. Returns nothing; failures are swallowed (terrain is enhancement
 * only — a flaky DEM endpoint must never break the map).
 */
export function applyTerrain(map: MLMap, on: boolean): void {
  try {
    if (on) {
      ensureDemSource(map);
      ensureHillshade(map);
      map.setTerrain({ source: TERRAIN.sourceId, exaggeration: TERRAIN.exaggeration });
    } else {
      map.setTerrain(null);
      if (map.getLayer(HILLSHADE_LAYER)) map.removeLayer(HILLSHADE_LAYER);
      // Leave the DEM source registered; cheap, and avoids re-add churn.
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Terrain toggle failed (non-fatal):", err);
  }
}

/**
 * basemap.ts — the single source of truth for the tiled basemap and 3D terrain.
 *
 * Everything the app knows about *where map tiles come from* lives in this one
 * config object. The rest of the app references styles/terrain only through
 * here, so the basemap can be swapped (e.g. to a self-hosted Protomaps PMTiles
 * build) without touching map init, controls, or overlay logic.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LICENSING (all commercial-use-safe in this default build):
 *   • Basemap styles: OpenFreeMap public instance (https://openfreemap.org) —
 *     OpenStreetMap-derived vector tiles, no API key, free for commercial use.
 *     Attribution to OpenStreetMap contributors + OpenFreeMap is required and
 *     is enforced by the always-on AttributionControl (see map/mapInit.ts).
 *   • Terrain DEM: AWS open-data Terrarium terrain tiles (see TERRAIN below).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * PRODUCTION: migrating to self-hosted Protomaps (PMTiles) for scale.
 * OpenFreeMap is generous but is a shared public good with no SLA. For a
 * commercial product at scale, host your own basemap:
 *   1. Download a Protomaps planet/region PMTiles extract (clip to Malawi to
 *      keep it small) — Protomaps basemaps are OSM-derived, BSD/ODbL-clean.
 *   2. `npm i pmtiles`, then register the protocol once at startup:
 *        import { Protocol } from "pmtiles";
 *        const protocol = new Protocol();
 *        maplibregl.addProtocol("pmtiles", protocol.tile);
 *   3. Point a BasemapStyle below at a Protomaps style JSON whose `sources`
 *      use `"url": "pmtiles://https://your-cdn/malawi.pmtiles"`.
 *   4. Swap DEFAULT_STYLE / add the new entry to BASEMAP_STYLES — no other app
 *      code changes, because everything routes through this object.
 * See README "Migrating the basemap to self-hosted Protomaps".
 */

import type { StyleSpecification } from "maplibre-gl";

/** Imagery providers usable for a hybrid satellite basemap. */
export type SatelliteProvider = "esri" | "sentinel2";

/** A basemap option shown in the style switcher. */
export interface BasemapStyle {
  /** Stable key persisted in the URL hash. */
  id: string;
  /** Human label for the UI. */
  label: string;
  /**
   * Either a style-JSON URL (string) or an inline StyleSpecification.
   * Routing both through one type is what makes the Protomaps swap trivial.
   * For hybrid satellite styles this is the synchronous imagery-only fallback;
   * the app upgrades it to a labelled hybrid via `buildHybridSatellite`.
   */
  style: string | StyleSpecification;
  /** If set, this is a satellite style; build the hybrid with this provider. */
  hybrid?: SatelliteProvider;
}

/**
 * Satellite basemap — EOX Sentinel-2 cloudless, as a HYBRID.
 *
 * Commercial-use-safe satellite imagery is the same trap as the Mapbox-GL one:
 * Google / Mapbox / Bing / Esri imagery is NOT free for commercial use. The
 * clean choice is EOX "Sentinel-2 cloudless" — a global, cloud-free mosaic
 * derived from ESA Copernicus Sentinel-2 data, published under CC-BY 4.0
 * (~10 m resolution). Attribution is a licence requirement and is carried on
 * the raster source below (shown in the AttributionControl when active).
 *
 * Two forms:
 *   • SATELLITE_STYLE — a minimal imagery-only style (synchronous fallback).
 *   • buildHybridSatellite() — fetches OpenFreeMap's full vector style, drops
 *     its opaque land fills so the imagery shows through, and keeps its road
 *     LINES, place LABELS and POI/tourist SYMBOLS on top of the raster. This is
 *     what the app uses, so the satellite view still shows locations, roads and
 *     tourist attractions (from OpenStreetMap), plus our own overlays.
 *
 * // VERIFY: Confirm the EOX tile endpoint's terms before commercial launch.
 * // The IMAGERY is CC-BY 4.0, but the public EOX tile *service* has fair-use
 * // limits — for commercial scale, self-host the Sentinel-2 cloudless tiles
 * // (freely downloadable) or arrange capacity with EOX, and update the `tiles`
 * // URL below. ~10 m resolution suits regional views; for building-level
 * // detail you'd license a commercial high-res provider (e.g. Maxar/Esri).
 */
const SENTINEL2_YEAR = 2020;
const LIBERTY_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const SAT_SOURCE_ID = "satellite-imagery";

/**
 * Raster imagery source per provider.
 *  • esri      — Esri World Imagery: HIGH RESOLUTION (sub-metre in many areas),
 *                so houses/footpaths/roads are clearly visible. // VERIFY:
 *                Esri's terms are NOT as clean as CC-BY — review the Esri
 *                licence before commercial use (free for many uses; commercial
 *                redistribution may need an ArcGIS/Esri agreement).
 *  • sentinel2 — EOX Sentinel-2 cloudless: ~10 m, COMMERCIAL-CLEAN (CC-BY 4.0)
 *                but too coarse to resolve houses/footpaths. // VERIFY: public
 *                EOX tile service has fair-use limits; self-host for scale.
 */
function rasterSource(provider: SatelliteProvider) {
  if (provider === "esri") {
    return {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        'Imagery © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, ' +
        "Maxar, Earthstar Geographics, and the GIS User Community",
    };
  }
  return {
    type: "raster" as const,
    tiles: [
      `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${SENTINEL2_YEAR}_3857/default/g/{z}/{y}/{x}.jpg`,
    ],
    tileSize: 256,
    maxzoom: 16,
    attribution:
      'Imagery: <a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> ' +
      `by EOX IT Services GmbH (contains modified Copernicus Sentinel data ${SENTINEL2_YEAR}) — CC-BY 4.0`,
  };
}

/** Imagery-only fallback style (used if the hybrid vector style can't load). */
function imageryOnlyStyle(provider: SatelliteProvider): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: { [SAT_SOURCE_ID]: rasterSource(provider) },
    layers: [
      { id: "sat-bg", type: "background", paint: { "background-color": "#0a1626" } },
      { id: SAT_SOURCE_ID, type: "raster", source: SAT_SOURCE_ID },
    ],
  };
}

/**
 * Build the hybrid satellite style: OpenFreeMap labels/roads/POIs over imagery.
 * Fetches the Liberty vector style, splices the imagery raster in at the bottom,
 * and removes the opaque area fills (landcover/landuse/water/buildings/hillshade)
 * that would otherwise hide the imagery — keeping line + symbol layers so place
 * names, roads, boundaries and tourist POIs remain visible on the satellite.
 *
 * Throws on network/parse failure; the caller falls back to imagery-only.
 */
export async function buildHybridSatellite(
  provider: SatelliteProvider
): Promise<StyleSpecification> {
  const res = await fetch(LIBERTY_STYLE_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Liberty style HTTP ${res.status}`);
  const base = (await res.json()) as StyleSpecification;

  base.sources = { ...base.sources, [SAT_SOURCE_ID]: rasterSource(provider) };

  // Keep only line + symbol layers (roads, boundaries, labels, POIs). Drop the
  // opaque fills so the imagery underneath shows through.
  const overlayLayers = base.layers.filter(
    (l) => l.type === "line" || l.type === "symbol"
  );

  base.layers = [
    { id: "sat-bg", type: "background", paint: { "background-color": "#0a1626" } },
    { id: SAT_SOURCE_ID, type: "raster", source: SAT_SOURCE_ID },
    ...overlayLayers,
  ];
  return base;
}

/**
 * Street / Light / Terrain / Satellite basemaps.
 *
 * "Terrain" reuses the Liberty street style as its base imagery — the 3D
 * terrain *mesh* is applied on top via TERRAIN (see map/terrain.ts). This way
 * the "Terrain" choice gives relief + roads + labels together.
 */
export const BASEMAP_STYLES: readonly BasemapStyle[] = [
  {
    id: "streets",
    label: "Streets",
    style: "https://tiles.openfreemap.org/styles/liberty",
  },
  {
    id: "light",
    label: "Light / Minimal",
    style: "https://tiles.openfreemap.org/styles/positron",
  },
  {
    id: "terrain",
    label: "Terrain",
    // Bright basemap reads well under hillshade; terrain mesh added on top.
    style: "https://tiles.openfreemap.org/styles/bright",
  },
  {
    id: "satellite",
    label: "Satellite (HD)",
    // High-resolution Esri imagery — houses/roads/footpaths clearly visible.
    style: imageryOnlyStyle("esri"),
    hybrid: "esri",
  },
  {
    id: "satellite-open",
    label: "Satellite (open)",
    // Commercial-clean Sentinel-2 (CC-BY 4.0) — ~10 m, coarser detail.
    style: imageryOnlyStyle("sentinel2"),
    hybrid: "sentinel2",
  },
];

export const DEFAULT_STYLE_ID = "streets";

export function getStyle(id: string): BasemapStyle {
  return BASEMAP_STYLES.find((s) => s.id === id) ?? BASEMAP_STYLES[0];
}

/**
 * 3D terrain configuration.
 *
 * We use Terrarium-encoded terrain-RGB tiles. The "terrarium" encoding is the
 * one published as AWS Open Data ("Terrain Tiles"), derived from public-domain
 * DEMs (SRTM, GMTED, NED, …).
 *
 * // VERIFY: Confirm the exact terrain-tile endpoint's terms of use before
 * // commercial launch. The canonical AWS Open Data bucket is
 * // s3://elevation-tiles-prod (public-domain DEM derivatives, no usage
 * // restriction). The HTTPS mirror below is convenient for development but its
 * // operator may rate-limit or change terms — for production, serve the
 * // Terrarium tiles from your own CDN / S3 ("requester pays" or a copy) and
 * // update TERRAIN_TILES accordingly.
 */
export const TERRAIN = {
  /** MapLibre source id for the DEM. */
  sourceId: "terrain-dem",
  /** Terrarium-encoded terrain-RGB tiles. */
  tiles: [
    "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
  ],
  encoding: "terrarium" as const,
  tileSize: 256,
  maxzoom: 15,
  /** Vertical exaggeration applied when terrain is enabled. */
  exaggeration: 1.4,
  attribution:
    'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a> (public-domain DEMs)',
} as const;

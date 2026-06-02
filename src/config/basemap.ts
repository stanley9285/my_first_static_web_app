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

/** A basemap option shown in the style switcher. */
export interface BasemapStyle {
  /** Stable key persisted in the URL hash. */
  id: string;
  /** Human label for the UI. */
  label: string;
  /**
   * Either a style-JSON URL (string) or an inline StyleSpecification.
   * Routing both through one type is what makes the Protomaps swap trivial.
   */
  style: string | StyleSpecification;
}

/**
 * Satellite basemap — EOX Sentinel-2 cloudless.
 *
 * Commercial-use-safe satellite imagery is the same trap as the Mapbox-GL one:
 * Google / Mapbox / Bing / Esri imagery is NOT free for commercial use. The
 * clean choice is EOX "Sentinel-2 cloudless" — a global, cloud-free mosaic
 * derived from ESA Copernicus Sentinel-2 data, published under CC-BY 4.0
 * (~10 m resolution). Attribution is a licence requirement and is carried on
 * the raster source below (shown in the AttributionControl when active).
 *
 * The style is inline (a raster source + a vector glyphs endpoint so our
 * overlay labels — landform names, road refs, vehicle plates — still render
 * over the imagery). Our overlays/terrain/vehicles are re-added on style.load,
 * so they appear on top of the satellite layer automatically.
 *
 * // VERIFY: Confirm the EOX tile endpoint's terms before commercial launch.
 * // The IMAGERY is CC-BY 4.0, but the public EOX tile *service* has fair-use
 * // limits — for commercial scale, self-host the Sentinel-2 cloudless tiles
 * // (freely downloadable) or arrange capacity with EOX, and update the `tiles`
 * // URL below. ~10 m resolution suits regional views; for building-level
 * // detail you'd license a commercial high-res provider (e.g. Maxar/Esri).
 */
const SENTINEL2_YEAR = 2020;
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  // Glyphs so symbol layers (our overlay labels) can render text over imagery.
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    "eox-s2cloudless": {
      type: "raster",
      tiles: [
        `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${SENTINEL2_YEAR}_3857/default/g/{z}/{y}/{x}.jpg`,
      ],
      tileSize: 256,
      maxzoom: 16,
      attribution:
        'Imagery: <a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> ' +
        `by EOX IT Services GmbH (contains modified Copernicus Sentinel data ${SENTINEL2_YEAR}) — CC-BY 4.0`,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0a1626" } },
    { id: "eox-s2cloudless", type: "raster", source: "eox-s2cloudless" },
  ],
};

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
    label: "Satellite",
    style: SATELLITE_STYLE,
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

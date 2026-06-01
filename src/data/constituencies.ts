/**
 * constituencies.ts — clean data-loader interface for the licence-sensitive
 * constituency overlay, kept separate from the (commercial-clean) geoBoundaries
 * layers so its provenance and obligations stay explicit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LICENSING WARNING — READ BEFORE COMMERCIAL USE
 * Malawi's National Assembly constituency boundaries are NOT bundled with a
 * confirmed commercial licence. Candidate sources:
 *
 *   • OpenStreetMap electoral/admin-boundary relations (admin_level), e.g.
 *     extracted via Overpass. Licence: ODbL — share-alike + attribution apply
 *     to any derived database. Commercial use is allowed but you inherit the
 *     ODbL obligations (publicly share the derived geometry database).
 *
 *   • Malawi Electoral Commission (MEC) — the AUTHORITATIVE source, but it is
 *     published WITHOUT an open licence. Authoritative-but-unlicensed: you must
 *     obtain written permission before shipping it commercially.
 *
 * Until rights are confirmed, the app ships an empty scaffold and this loader
 * simply surfaces "no data" so the rest of the product is unaffected.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * To populate the layer:
 *   // TODO: drop constituency GeoJSON here →  public/data/constituencies-MWI.geojson
 * matching the documented schema (see EXPECTED_SCHEMA below and the file's
 * own `metadata.featureSchema`). No code changes are required: the standard
 * loader picks it up and the overlay renders automatically.
 */

import type { OverlayCollection } from "../types";
import { loadOverlay, type LoadResult } from "./loader";

/**
 * Documented target schema for whoever drops the geometry in. Kept as a runtime
 * constant (not just a comment) so it can be logged / shown in tooling.
 */
export const EXPECTED_SCHEMA = {
  type: "FeatureCollection",
  feature: {
    geometry: "Polygon | MultiPolygon (WGS84 / EPSG:4326)",
    properties: {
      id: "string (required) — stable unique id (OSM relation id or MEC code)",
      name: "string (required) — constituency name",
      level: '"constituency" (required)',
      region: "string (optional) — parent ADM1 region",
      district: "string (optional) — parent ADM2 district",
    },
  },
} as const;

export interface ConstituencyLoad {
  result: LoadResult;
  /** True when the file loaded fine but contains zero features (the scaffold). */
  isEmptyScaffold: boolean;
  data: OverlayCollection | null;
}

/**
 * The clean interface the app calls. Returns the standard LoadResult plus an
 * explicit `isEmptyScaffold` flag so the UI can show a helpful "drop GeoJSON
 * here" message instead of a silent empty layer.
 */
export async function loadConstituencies(): Promise<ConstituencyLoad> {
  const result = await loadOverlay("constituencies");
  if (result.ok) {
    return {
      result,
      isEmptyScaffold: result.count === 0,
      data: result.data,
    };
  }
  return { result, isEmptyScaffold: false, data: null };
}

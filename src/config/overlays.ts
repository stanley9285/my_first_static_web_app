/**
 * overlays.ts — declarative definition of the three boundary overlays.
 *
 * Each overlay is fully described by data here. map/overlays.ts reads this list
 * to wire up sources, fill/outline/hover layers, and toggling — so adding or
 * re-styling an overlay never means touching the map plumbing.
 */

import type { OverlayId } from "../types";

export interface OverlayConfig {
  id: OverlayId;
  /** Sidebar tab + attribution label. */
  label: string;
  /** Where the GeoJSON is served from (under public/). */
  url: string;
  /** Fill / outline colour (semi-transparent fill keeps the basemap visible). */
  color: string;
  /** Fill opacity for the resting (non-hovered) state. */
  fillOpacity: number;
  /** Whether this layer is visible on first load (before URL-hash override). */
  defaultVisible: boolean;
  /** Attribution line required by the data licence. */
  attribution: string;
  /**
   * Licence note surfaced in the UI for sensitive layers (constituencies).
   * Undefined = standard, no special warning needed.
   */
  licenseWarning?: string;
}

export const OVERLAYS: readonly OverlayConfig[] = [
  {
    id: "regions",
    label: "Regions",
    url: "data/geoBoundaries-MWI-ADM1.geojson",
    color: "#1f78b4",
    fillOpacity: 0.18,
    defaultVisible: true,
    attribution:
      'Regions/Districts: <a href="https://www.geoboundaries.org" target="_blank" rel="noopener">geoBoundaries</a> (Runfola et al., 2020), CC-BY 4.0',
  },
  {
    id: "districts",
    label: "Districts",
    url: "data/geoBoundaries-MWI-ADM2.geojson",
    color: "#33a02c",
    fillOpacity: 0.16,
    defaultVisible: false,
    // geoBoundaries already credited via the regions overlay; avoid duplicate.
    attribution: "",
  },
  {
    id: "constituencies",
    label: "Constituencies",
    url: "data/constituencies-MWI.geojson",
    color: "#e31a1c",
    fillOpacity: 0.16,
    defaultVisible: false,
    attribution:
      'Constituencies: source/licence to be confirmed — see README',
    // LICENSING: this layer is licence-sensitive. See README + the loader.
    licenseWarning:
      "Constituency boundary rights must be confirmed before commercial use. " +
      "OpenStreetMap (ODbL, share-alike) or the Malawi Electoral Commission " +
      "(authoritative but unlicensed) are the candidate sources.",
  },
] as const;

export function getOverlay(id: OverlayId): OverlayConfig {
  const o = OVERLAYS.find((x) => x.id === id);
  if (!o) throw new Error(`Unknown overlay: ${id}`);
  return o;
}

/** Full-country home view used by the reset button and as the default camera. */
export const MALAWI_HOME = {
  center: [34.3, -13.25] as [number, number],
  zoom: 5.6,
  bearing: 0,
  pitch: 0,
  /** [w, s, e, n] — used to fit bounds on first load. */
  bounds: [32.6, -17.2, 36.0, -9.3] as [number, number, number, number],
};

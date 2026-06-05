/**
 * attractions.ts — load the tourist-attraction dataset.
 *
 * Returns a clean Attraction[] (never throws) so a missing/unreachable file
 * degrades gracefully (no pins, no crash). Photos are not bundled: drop licensed
 * image URLs into each feature's `images[]` in the GeoJSON and they appear in
 * the info card automatically. See README "Tourist attractions".
 */

import type { Attraction } from "../types";

const URL = "data/attractions-MWI.geojson";

export async function loadAttractions(): Promise<Attraction[]> {
  try {
    const res = await fetch(URL, { cache: "no-cache" });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      features?: Array<{
        properties?: Record<string, unknown>;
        geometry?: { type?: string; coordinates?: [number, number] };
      }>;
    };
    if (!Array.isArray(json.features)) return [];
    const out: Attraction[] = [];
    for (const f of json.features) {
      const p = f.properties ?? {};
      const g = f.geometry;
      if (!g || g.type !== "Point" || !Array.isArray(g.coordinates)) continue;
      out.push({
        id: String(p.id ?? out.length),
        name: String(p.name ?? "Attraction"),
        category: (p.category as Attraction["category"]) ?? "landmark",
        region: p.region as string | undefined,
        description: p.description as string | undefined,
        website: p.website as string | undefined,
        images: Array.isArray(p.images) ? (p.images as string[]) : [],
        lng: g.coordinates[0],
        lat: g.coordinates[1],
      });
    }
    return out;
  } catch {
    return [];
  }
}

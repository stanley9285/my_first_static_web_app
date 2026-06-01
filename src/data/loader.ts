/**
 * loader.ts — the single, typed entry point for fetching overlay GeoJSON.
 *
 * Every overlay (including constituencies) loads through `loadOverlay`, which
 * guarantees:
 *   • a normalised, validated OverlayCollection on success;
 *   • a structured { ok: false, error } result on *any* failure (network,
 *     404, malformed JSON, wrong shape) — never a throw — so a missing or
 *     unreachable data file degrades gracefully instead of crashing the app.
 */

import type { OverlayCollection, OverlayId } from "../types";
import { getOverlay } from "../config/overlays";

export type LoadResult =
  | { ok: true; id: OverlayId; data: OverlayCollection; count: number }
  | { ok: false; id: OverlayId; error: string };

function isFeatureCollection(v: unknown): v is OverlayCollection {
  return (
    !!v &&
    typeof v === "object" &&
    (v as { type?: unknown }).type === "FeatureCollection" &&
    Array.isArray((v as { features?: unknown }).features)
  );
}

export async function loadOverlay(id: OverlayId): Promise<LoadResult> {
  const cfg = getOverlay(id);
  try {
    const res = await fetch(cfg.url, { cache: "no-cache" });
    if (!res.ok) {
      return { ok: false, id, error: `HTTP ${res.status} for ${cfg.url}` };
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, id, error: `Invalid JSON in ${cfg.url}` };
    }
    if (!isFeatureCollection(json)) {
      return { ok: false, id, error: `Not a GeoJSON FeatureCollection: ${cfg.url}` };
    }
    // Defensive: ensure each feature has a numeric id for feature-state hover.
    json.features.forEach((f, i) => {
      if (f.id === undefined || f.id === null) f.id = i;
    });
    return { ok: true, id, data: json, count: json.features.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, id, error: `Network error loading ${cfg.url}: ${msg}` };
  }
}

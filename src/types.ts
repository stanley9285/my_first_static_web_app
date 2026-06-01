import type {
  FeatureCollection,
  Feature,
  Polygon,
  MultiPolygon,
  Point,
  Geometry,
} from "geojson";

/** Bounding box as [minX, minY, maxX, maxY] in WGS84 degrees. */
export type BBox = [number, number, number, number];

/** Stable, normalised property schema shared by every overlay feature. */
export interface OverlayFeatureProps {
  /** Stable unique id (geoBoundaries shapeID, OSM relation id, MEC code…). */
  id: string;
  /** Display name. */
  name: string;
  /** Which overlay this feature belongs to. */
  level: "region" | "district" | "constituency" | "landform";
  /** Parent ADM1 region name (districts, constituencies & landforms). */
  region?: string;
  /** Parent ADM2 district name (constituencies only, where known). */
  district?: string;
  /** Pre-computed bbox so we can fly-to without re-walking geometry. */
  bbox?: BBox;
  /** Landforms: natural-feature category (peak, plateau, lake, river, park…). */
  featureType?: string;
  /** Landforms: elevation in metres (peaks/plateaus) or lake surface level. */
  elevation?: number;
  /** Landforms: short descriptive blurb shown in the detail card. */
  description?: string;
}

export type OverlayGeometry = Polygon | MultiPolygon | Point;
export type OverlayFeature = Feature<OverlayGeometry, OverlayFeatureProps>;
export type OverlayCollection = FeatureCollection<
  OverlayGeometry,
  OverlayFeatureProps
>;

/** Geometry used by helpers that walk arbitrary GeoJSON. */
export type AnyGeometry = Geometry;

/** The switchable overlay tabs. */
export type OverlayId = "regions" | "districts" | "constituencies" | "landforms";

/** Persisted UI + map state (mirrored to the URL hash). */
export interface AppState {
  /** Active basemap style key (see config/basemap.ts). */
  style: string;
  /** Whether 3D terrain is enabled. */
  terrain: boolean;
  /** Which overlays are currently visible. */
  visible: Record<OverlayId, boolean>;
  /** Which overlay tab is focused in the sidebar. */
  activeTab: OverlayId;
  /** Camera. */
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  /** Selected feature, as `${OverlayId}:${featureId}` or null. */
  selected: string | null;
}

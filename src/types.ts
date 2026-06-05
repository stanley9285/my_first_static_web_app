import type {
  FeatureCollection,
  Feature,
  Polygon,
  MultiPolygon,
  Point,
  LineString,
  MultiLineString,
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
  level: "region" | "district" | "constituency" | "landform" | "road";
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
  /** Landforms / roads: short descriptive blurb shown in the detail card. */
  description?: string;
  /** Roads: reference (e.g. M1), class, corridor, endpoints, surface, length. */
  ref?: string;
  roadClass?: string;
  corridor?: string;
  from?: string;
  to?: string;
  surface?: string;
  lengthKm?: number;
}

export type OverlayGeometry =
  | Polygon
  | MultiPolygon
  | Point
  | LineString
  | MultiLineString;
export type OverlayFeature = Feature<OverlayGeometry, OverlayFeatureProps>;
export type OverlayCollection = FeatureCollection<
  OverlayGeometry,
  OverlayFeatureProps
>;

/** Geometry used by helpers that walk arbitrary GeoJSON. */
export type AnyGeometry = Geometry;

/** The switchable overlay tabs. */
export type OverlayId =
  | "regions"
  | "districts"
  | "constituencies"
  | "landforms"
  | "roads";

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
  /** Live goods-vehicle tracking enabled (demo feed in the default build). */
  tracking: boolean;
  /** Tourist-attraction pins visible. */
  attractions: boolean;
}

/**
 * A single goods-vehicle position sample — the contract a real-time GPS feed
 * must satisfy (see src/data/vehicles.ts). Designed to mirror a typical AVL /
 * telematics payload so a production feed can map onto it directly.
 */
export interface VehiclePosition {
  /** Stable vehicle/asset id. */
  id: string;
  /** Human label, e.g. number plate. */
  plate: string;
  /** Position (WGS84). */
  lng: number;
  lat: number;
  /** Heading in degrees clockwise from north (0–360). */
  heading: number;
  /** Ground speed in km/h. */
  speedKmh: number;
  /** Operational status. */
  status: "moving" | "idle" | "stopped" | "loading";
  /** Cargo description (optional). */
  cargo?: string;
  /** Ref/name of the corridor the vehicle is currently on (optional). */
  road?: string;
  /** Last-update timestamp (epoch ms). */
  updatedAt: number;
}

/** A tourist attraction shown as an animated pin with a rich info card. */
export interface Attraction {
  id: string;
  name: string;
  category:
    | "national-park"
    | "reserve"
    | "mountain"
    | "plateau"
    | "lake"
    | "beach"
    | "island"
    | "waterfall"
    | "cultural"
    | "lodge"
    | "landmark";
  region?: string;
  description?: string;
  /** Official site or info page (opened in a new tab; may also be embedded). */
  website?: string;
  /** Licensed image URLs; empty → a styled placeholder is shown. */
  images: string[];
  /** [lng, lat]. */
  lng: number;
  lat: number;
}

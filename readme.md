# Malawi Interactive Map

A production-grade, standalone front-end map of Malawi built with
**[MapLibre GL JS](https://maplibre.org/)** (the BSD-licensed, commercial-safe
fork of Mapbox GL). It renders a real tiled vector basemap with continuous
street/terrain/label detail and toggleable political boundary overlays —
**Regions**, **Districts**, and **Constituencies**.

> **Why MapLibre, not Mapbox GL JS?** Mapbox GL JS v2+ is relicensed under terms
> that effectively require Mapbox's paid service. MapLibre GL JS is a true
> open-source (BSD-2-Clause) fork with no such tie-in — the right choice for a
> commercial product. **Do not** swap in `mapbox-gl` v2+.

## Features

- **Continuous vector basemap** (OpenFreeMap) — pan/zoom to street level with
  labels that scale naturally; no custom label management.
- **Style switcher** — Streets, Light/Minimal, Terrain.
- **3D terrain toggle** — MapLibre terrain mesh + hillshade from a Terrarium DEM.
- **Five independent overlay tabs** — Regions, Districts, Constituencies,
  **Landforms** (notable natural features: peaks, plateaus, lakes, rivers,
  wetlands and protected areas, as labelled colour-coded markers with GPS
  coordinates + directions), and **Freight roads** (Malawi's main goods
  corridors — M1 spine, M5 lakeshore, M3, M6, plus the Beira/Nacala export
  links — as cased, labelled lines). Boundaries render as semi-transparent
  fills + outlines so the basemap stays visible; hover highlight + name
  tooltip; click flies to the feature and opens a detail card.
- **Live goods-vehicle tracking** — a toggleable layer that plots tracked
  vehicles as status-coloured, heading-oriented markers, fed through a clean
  `VehicleFeed` interface. The default build ships a clearly-labelled **demo**
  that simulates trucks moving along the freight corridors; point it at your
  real GPS/telematics feed for production (see below).
- **State survives refresh** — active style, terrain, layer visibility, tab,
  camera, and selection are all encoded in the URL hash (shareable links).
- **Always-on attribution**, **keyboard-accessible** controls (ARIA), responsive
  layout, and **graceful failure** if any tile/data source is unreachable.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm run build        # type-check + production build to dist/
npm run preview      # serve the production build
npm run typecheck    # tsc --noEmit
npm run data:build   # re-download + simplify the geoBoundaries overlays
```

> **Note:** the basemap and terrain tiles load from public CDNs at runtime, so
> a network connection is required to see the map imagery. The app degrades
> gracefully (visible, non-blocking error; no crash) if a source is blocked.

## Project structure

```
index.html                 App shell
src/
  main.ts                  Entry point — wires map, UI, data, state
  state.ts                 App state store + URL-hash persistence
  types.ts                 Shared types (normalised overlay schema)
  config/
    basemap.ts             SINGLE basemap/terrain config (Protomaps-swappable)
    overlays.ts            Declarative overlay definitions
  map/
    mapInit.ts             Map creation + attribution/nav/scale controls
    terrain.ts             3D terrain + hillshade toggle
    overlays.ts            Overlay rendering (polygon/point/line), interactions
    vehicles.ts            Vehicle marker rendering (status colour + heading)
  data/
    loader.ts              Typed, never-throws GeoJSON loader (graceful fail)
    constituencies.ts      Licence-aware constituency loader interface
    vehicles.ts            VehicleFeed interface + live-feed scaffold + demo
  ui/
    controls.ts            Style switcher / terrain / reset
    panel.ts               Tabs, toggles, feature list, detail card
    toast.ts               Non-blocking status/error notifier
scripts/
  build-data.mjs           Reproducible boundary-data pipeline
public/data/               Local datasets served at /data/*.geojson
  geoBoundaries-MWI-ADM1.geojson    3 regions
  geoBoundaries-MWI-ADM2.geojson    28 districts (+ parent region)
  constituencies-MWI.geojson        scaffold (empty — see below)
  landforms-MWI.geojson             29 curated natural features (points)
  roads-MWI.geojson                 11 goods routes incl. borders (lines)
  SOURCES.md               Per-file provenance + refresh instructions
```

## Datasets — where they came from & how to refresh

| Overlay | File | Source | License |
|---------|------|--------|---------|
| Regions (3) | `public/data/geoBoundaries-MWI-ADM1.geojson` | geoBoundaries gbOpen ADM1 | CC-BY 4.0 |
| Districts (28) | `public/data/geoBoundaries-MWI-ADM2.geojson` | geoBoundaries gbOpen ADM2 | CC-BY 4.0 |
| Constituencies | `public/data/constituencies-MWI.geojson` | **not bundled** (scaffold) | **unconfirmed** |
| Landforms (29) | `public/data/landforms-MWI.geojson` | curated geographic facts | public domain (facts) |
| Roads (11) | `public/data/roads-MWI.geojson` | curated simplified routes | curated; **not lane-accurate** |

`npm run data:build` (see `scripts/build-data.mjs`) downloads the geoBoundaries
ADM1/ADM2 GeoJSON straight from the geoBoundaries release data on GitHub,
simplifies the geometry (Douglas–Peucker), computes each district's **parent
region** via a point-in-polygon test, normalises the properties to a stable
schema, and writes the results to `public/data/`. Re-run it to refresh the data.

### Adding the constituency layer

`constituencies-MWI.geojson` ships as a **valid but empty** FeatureCollection
with a documented `metadata.featureSchema`. To populate it, drop a
licence-cleared GeoJSON at that path (properties: `id`, `name`, `level:
"constituency"`, optional `region`/`district`; Polygon/MultiPolygon, EPSG:4326).
No code changes are needed — the loader and overlay pick it up automatically.
See `src/data/constituencies.ts` and `public/data/SOURCES.md`.

---

## Licensing & Commercial Use

This stack is assembled to be **commercial-use-safe**, with one explicit caveat
(constituencies). Every obligation below is a license requirement, not optional
polish. The on-map attribution control credits these sources and is always
visible.

### Software

| Component | License | Obligation |
|-----------|---------|------------|
| MapLibre GL JS | BSD-2-Clause | Include the copyright/license notice. Commercial use OK. |
| Vite, TypeScript, Turf (build only) | MIT/ISC | Permissive; include notices. |

### Basemap tiles — OpenFreeMap

- **Source:** OpenFreeMap public instance (`https://tiles.openfreemap.org`),
  OpenStreetMap-derived vector tiles. No API key.
- **License:** the underlying data is **OpenStreetMap, ODbL**; OpenFreeMap is
  free for commercial use.
- **Obligation:** **must** display "© OpenStreetMap contributors" and credit
  OpenFreeMap (both shown in the attribution control). OpenFreeMap's public
  instance has **no SLA** — for commercial scale, self-host (see Protomaps
  migration below).

### Terrain DEM — AWS Terrain Tiles (Terrarium)

- **Source:** Terrarium-encoded terrain-RGB tiles from the AWS Open Data
  "Terrain Tiles" dataset (`s3://elevation-tiles-prod`), derived from
  public-domain DEMs (SRTM, GMTED, NED, …).
- **License:** the DEM derivatives are **public domain**; attribution is
  courtesy, not legally required, but is included.
- **`// VERIFY:`** Confirm the exact terrain endpoint's terms before commercial
  launch (see the note in `src/config/basemap.ts`). For production, serve the
  Terrarium tiles from **your own CDN/S3** rather than a convenience mirror.

### Boundaries — geoBoundaries (Regions & Districts)

- **Source:** geoBoundaries Open (gbOpen) ADM1/ADM2 for Malawi —
  <https://www.geoboundaries.org>.
- **License:** **CC-BY 4.0** — commercial use permitted **with attribution**.
- **Obligation:** credit **geoBoundaries — Runfola, D. et al. (2020),
  *geoBoundaries: A global database of political administrative boundaries*,
  PLoS ONE 15(4): e0231866** (shown in the attribution control).

### Landforms / natural features

- **Source:** a small **curated** set of Malawi's notable natural features
  (peaks, plateaus, highlands, lakes, rivers, wetlands, parks and reserves),
  stored at `public/data/landforms-MWI.geojson`.
- **License:** the contents are **factual geographic data** — place names,
  categories, and representative coordinates — which are **not copyrightable**,
  so the layer is safe for commercial use. It was compiled from general
  geographic knowledge, **not** copied from any rights-encumbered database.
- **Notes:** coordinates are representative label points (approximate), not
  survey-grade. To extend it, append features matching the documented schema
  (`metadata.featureSchema` in the file; `level: "landform"`, `featureType`,
  optional `elevation`/`region`/`description`; Point geometry). No code change
  is needed — the loader and the labelled point layer pick them up.

### Freight roads & vehicle tracking

- **Roads source:** a **curated** set of the main roads used for transporting
  goods, stored at `public/data/roads-MWI.geojson` — currently the M1 north–south
  spine, the M5 lakeshore road, Blantyre–Mangochi (via Zomba & Liwonde),
  Blantyre–Mulanje–Muloza, Lilongwe–Mchinji (Mwami/Zambia), Lilongwe–Salima,
  Karonga–Chitipa, Dedza–Mozambique, Blantyre–Mwanza (Beira), and the
  Liwonde/Mangochi–Namwera–Chiponde routes (Nacala). The `ref` is the official
  road number where confident (e.g. M1, M5) and a **route label** otherwise
  (e.g. `LL–Mchinji`) — **verify/replace the official M-numbers before launch.**
- **License:** road **references and town locations are factual** (not
  copyrightable); the geometry is **simplified centreline routing**, authored
  locally — commercial-use-safe as an overview.
- **⚠ Accuracy caveat:** this geometry is a **corridor overview, NOT
  lane-accurate**. It is fine for highlighting routes and for a tracking demo,
  but **it cannot be used to map-match / snap real vehicle GPS positions to the
  correct lane**. For production tracking you need a **licensed road network**
  — OpenStreetMap (**ODbL**, share-alike + attribution) or a **commercial road
  dataset** — plus a routing/map-matching engine (e.g. Valhalla, OSRM, GraphHopper).

#### Wiring a real GPS feed (production)

The app consumes vehicle positions **only** through the `VehicleFeed` interface
in `src/data/vehicles.ts`, so swapping the demo for a live feed is a one-line
change in `src/main.ts`:

```ts
// main.ts — replace the demo with your telematics source:
feed = createLiveFeed({ url: "wss://gps.example.com/stream", token: "…" });
```

Implement `createLiveFeed` to open your WebSocket/MQTT stream (or poll a REST
endpoint), map each provider record onto the `VehiclePosition` shape
(`id, plate, lng, lat, heading, speedKmh, status, cargo?, road?, updatedAt`),
and emit batches to subscribers. Nothing in the map/UI layer changes. The
default build's demo feed (`createDemoFeed`) animates simulated trucks along the
corridors purely to showcase the capability — it is clearly badged **DEMO** in
the UI and ships no data masquerading as real tracking.

### Constituencies — ⚠ RIGHTS NOT CONFIRMED, DO NOT SHIP COMMERCIALLY YET

The constituency layer is **not bundled** with a confirmed commercial license.
The UI shows a prominent licensing warning on that tab. Candidate sources:

- **OpenStreetMap** electoral/admin boundaries (via Overpass): **ODbL** —
  commercial use is allowed but carries **share-alike + attribution**
  obligations on any derived geometry database.
- **Malawi Electoral Commission (MEC):** the **authoritative** source, but
  published **without an open license** — authoritative-but-unlicensed. Obtain
  **written permission** before any commercial use.

**Action required:** confirm the source's rights (and satisfy ODbL share-alike
if using OSM) before shipping the constituency layer in a commercial product.
Everything else in this stack is commercial-clean.

---

## Migrating the basemap to self-hosted Protomaps (production scale)

The entire basemap/terrain configuration lives in **one object**
(`src/config/basemap.ts`); the rest of the app references it only through that
module, so the basemap can be swapped without touching map init, controls, or
overlays. To move off the shared OpenFreeMap instance onto self-hosted
[Protomaps](https://protomaps.com/) PMTiles:

1. Build a Protomaps PMTiles extract (clip to Malawi to keep it small).
   Protomaps basemaps are OSM-derived and BSD/ODbL-clean.
2. `npm i pmtiles`, then register the protocol once at startup:
   ```ts
   import { Protocol } from "pmtiles";
   const protocol = new Protocol();
   maplibregl.addProtocol("pmtiles", protocol.tile);
   ```
3. Add a `BasemapStyle` in `basemap.ts` whose style JSON `sources` use
   `"url": "pmtiles://https://your-cdn/malawi.pmtiles"`.
4. Point `DEFAULT_STYLE_ID` at it. No other app code changes.

Also serve the **terrain** Terrarium tiles from your own CDN/S3 at this point.

## Accessibility & resilience

- All controls have ARIA roles/labels; the map canvas is focusable with a
  description (arrow keys pan, +/- zoom).
- Honours `prefers-color-scheme` and `prefers-reduced-motion`.
- Responsive: sidebar docks right on desktop, becomes a bottom sheet on mobile.
- Every data fetch returns a structured result instead of throwing; a missing
  or unreachable GeoJSON/tile source shows a visible, non-blocking message and
  the rest of the app keeps working.

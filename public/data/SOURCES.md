# Local datasets (`public/data/`)

These GeoJSON files are served at `/data/*.geojson` and fetched by the app at
runtime. Storing them locally (rather than hot-linking a CDN) keeps the app
fast, offline-capable, and avoids hammering the upstream providers.

| File | Source | Regenerate with | License |
|------|--------|-----------------|---------|
| `geoBoundaries-MWI-ADM1.geojson` (3 regions) | geoBoundaries gbOpen ADM1, Malawi | `npm run data:build` | CC-BY 4.0 |
| `geoBoundaries-MWI-ADM2.geojson` (28 districts) | geoBoundaries gbOpen ADM2, Malawi | `npm run data:build` | CC-BY 4.0 |
| `constituencies-MWI.geojson` | **Not bundled — scaffold only** | manual (see below) | **Unconfirmed — verify before commercial use** |
| `landforms-MWI.geojson` (29 features) | Curated geographic facts | manual edit | Public domain (factual names & coordinates) |
| `roads-MWI.geojson` (11 routes) | Curated simplified routes | manual edit | Curated; geometry **not lane-accurate** |

## geoBoundaries (ADM1 / ADM2)

Downloaded straight from the geoBoundaries release data on GitHub by
`scripts/build-data.mjs`, then simplified (Douglas–Peucker) and tagged with a
parent `region` per district. To refresh, run `npm run data:build`.

Attribution requirement (CC-BY 4.0): credit geoBoundaries — Runfola, D. et al.
(2020) *geoBoundaries: A global database of political administrative
boundaries.* PLoS ONE 15(4): e0231866. This credit is shown in the on-map
attribution control.

## Constituencies (electoral boundaries)

`constituencies-MWI.geojson` ships as a **valid but empty** FeatureCollection
plus a documented `metadata.featureSchema`. The app loads it through a clean
data-loader interface and renders nothing until real geometry is dropped in.

To populate it, place a GeoJSON of Malawi's National Assembly constituencies at
this path matching the documented schema (properties: `id`, `name`, optional
`region`/`district`, `level: "constituency"`; Polygon/MultiPolygon, EPSG:4326).

Candidate sources and their caveats:

- **OpenStreetMap** electoral/admin-boundary relations, e.g. via Overpass
  (`admin_level` electoral boundaries). License: **ODbL** — share-alike +
  attribution obligations apply to derived databases.
- **Malawi Electoral Commission (MEC)** — authoritative, but **not released
  under an open license**. Authoritative-but-unlicensed: obtain written
  permission before any commercial use.

**Do not ship the constituency layer in a commercial product until the source's
rights are confirmed.** See the README "Licensing & Commercial Use" section.

## Landforms / natural features

`landforms-MWI.geojson` is a curated set of notable Malawian natural features
(peaks, plateaus, highlands, lakes, rivers, wetlands, parks and reserves) as
labelled points. The contents are **factual geographic data** (names,
categories, representative coordinates) which are not copyrightable, so the
layer is **commercial-use-safe**. Coordinates are approximate label points, not
survey-grade. Extend it by appending features matching the `metadata.featureSchema`
in the file (`level: "landform"`, `featureType`, optional
`elevation`/`region`/`description`; Point geometry).

## Freight roads

`roads-MWI.geojson` is a curated set of Malawi's primary goods-transport
corridors as **simplified centrelines** (LineStrings routed through the main
towns). Road references and town locations are factual; the geometry is an
**overview, not lane-accurate**. It is suitable for highlighting corridors and
for the tracking demo, but **not** for map-matching real vehicle GPS positions
— for that, replace it with a licensed road network (OpenStreetMap/ODbL or a
commercial dataset) plus a routing/map-matching engine. See the README
"Freight roads & vehicle tracking" section. Lengths in `lengthKm` are computed
from the simplified geometry and are approximate.

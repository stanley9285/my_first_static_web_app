/**
 * main.ts — application entry point. Wires the map, controls, sidebar panel,
 * data loaders and the URL-hash state store together.
 */

import "./styles.css";
import type { Map as MLMap } from "maplibre-gl";

import { store } from "./state";
import type { OverlayId } from "./types";
import { getStyle, buildHybridSatellite } from "./config/basemap";
import { createMap, flyHome } from "./map/mapInit";
import { applyTerrain } from "./map/terrain";
import { OverlayManager, type SelectedFeatureInfo } from "./map/overlays";
import { VehicleLayer } from "./map/vehicles";
import { createDemoFeed, type VehicleFeed } from "./data/vehicles";
import { loadConstituencies } from "./data/constituencies";
import { renderControls } from "./ui/controls";
import { PanelUI } from "./ui/panel";
import { toast } from "./ui/toast";

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id} in index.html`);
  return node;
}

function bootstrap(): void {
  const mapEl = el("map");
  const controlsEl = el("map-controls");
  const sidebarEl = el("sidebar");

  let map: MLMap;
  try {
    map = createMap(mapEl);
  } catch (err) {
    // Catastrophic: even the map couldn't init. Show a message, don't crash.
    const msg = err instanceof Error ? err.message : String(err);
    sidebarEl.innerHTML = `<div class="fatal">Map failed to initialise: ${msg}</div>`;
    return;
  }

  const initial = store.get();
  let styleReady = false;
  let dataLoaded = false;

  // ── Sidebar panel ──────────────────────────────────────────────────────────
  const panel = new PanelUI(
    sidebarEl,
    { activeTab: initial.activeTab, visible: initial.visible },
    {
      onTabChange: (id) => {
        store.set({ activeTab: id });
        panel.setActiveTab(id);
      },
      onToggleVisibility: (id, on) => {
        overlays.setVisibility(id, on);
        panel.setVisibility(id, on);
        store.set({ visible: { ...store.get().visible, [id]: on } });
      },
      onSelectFeature: (id, featureId) => {
        const info = overlays.selectAndFly(id, featureId);
        if (info) openDetail(info);
      },
      onCloseDetail: () => {
        overlays.clearSelection();
        panel.clearDetail();
        store.set({ selected: null });
      },
    }
  );

  // ── Overlay manager ─────────────────────────────────────────────────────────
  const overlays = new OverlayManager(map, initial.visible, {
    onSelect: (info) => openDetail(info),
    onLoadStatus: (id, status) => {
      if (status.ok) {
        const data = overlays.getData(id);
        if (data) panel.setData(id, data);
        panel.setStatus(id, {
          loaded: true,
          count: status.count,
          isEmptyScaffold: id === "constituencies" && status.count === 0,
        });
      } else {
        panel.setStatus(id, { loaded: true, error: status.error });
        toast(`Could not load ${id}: ${status.error}`, "error");
      }
    },
  });

  function openDetail(info: SelectedFeatureInfo): void {
    panel.showDetail(info);
    store.set({ selected: `${info.overlay}:${info.id}` });
  }

  // Apply a basemap style. Satellite is resolved asynchronously into a hybrid
  // (imagery + OpenFreeMap labels/roads/POIs); on failure we fall back to
  // imagery-only so the map never breaks. A style swap wipes user sources, so
  // refreshMap re-adds overlays/terrain/vehicles once the new style is ready.
  async function applyStyle(styleId: string): Promise<void> {
    styleReady = false;
    const cfg = getStyle(styleId);
    if (cfg.hybrid) {
      try {
        map.setStyle(await buildHybridSatellite(cfg.hybrid));
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Hybrid satellite unavailable, using imagery only:", err);
        toast("Map labels unavailable — showing imagery only.", "error", 4000);
      }
    }
    map.setStyle(cfg.style);
  }

  // ── Live goods-vehicle tracking (demo feed in the default build) ─────────────
  const vehicleLayer = new VehicleLayer(map, (v) => panel.showVehicleDetail(v));
  let feed: VehicleFeed | null = null;
  let unsubscribeFeed: (() => void) | null = null;

  function setTracking(on: boolean): void {
    store.set({ tracking: on });
    if (on) {
      vehicleLayer.setVisible(true);
      startFeed();
    } else {
      stopFeed();
      vehicleLayer.clear();
      vehicleLayer.setVisible(false);
    }
  }

  function startFeed(): void {
    if (!dataLoaded) return; // roads needed; will be started after data loads
    if (!feed) {
      const roads = overlays.getData("roads");
      if (!roads) {
        toast("Tracking demo needs the freight-roads data (unavailable).", "error");
        return;
      }
      // SWAP-IN POINT: replace createDemoFeed(roads) with your real feed, e.g.
      //   feed = createLiveFeed({ url: "wss://…", token: "…" });
      feed = createDemoFeed(roads);
      unsubscribeFeed = feed.subscribe((vehicles) => vehicleLayer.update(vehicles));
    }
    vehicleLayer.ensure();
    feed.start();
  }

  function stopFeed(): void {
    feed?.stop();
    unsubscribeFeed?.();
    unsubscribeFeed = null;
    feed = null;
  }

  // ── Controls (style switcher / terrain / tracking / reset) ───────────────────
  renderControls(controlsEl, {
    onStyleChange: (styleId) => {
      store.set({ style: styleId });
      void applyStyle(styleId);
    },
    onTerrainToggle: (on) => {
      store.set({ terrain: on });
      applyTerrain(map, on);
    },
    onTrackingToggle: (on) => setTracking(on),
    onHome: () => {
      overlays.clearSelection();
      panel.clearDetail();
      store.set({ selected: null });
      flyHome(map);
    },
  });

  // Re-add terrain + overlays whenever a style finishes loading (initial &
  // after every setStyle). Idempotent, so calling it repeatedly is safe.
  function refreshMap(): void {
    if (!styleReady) return;
    applyTerrain(map, store.get().terrain);
    overlays.addAllToMap();
    // Vehicle layers/icon are wiped by a style swap too — re-create them and
    // re-apply current visibility/data on top of the overlays.
    vehicleLayer.ensure();
    vehicleLayer.setVisible(store.get().tracking);
    restoreSelection();
  }

  let selectionRestored = false;
  function restoreSelection(): void {
    if (selectionRestored || !dataLoaded) return;
    const sel = store.get().selected;
    if (!sel) {
      selectionRestored = true;
      return;
    }
    const [ov, fid] = sel.split(":");
    const info = overlays.getInfo(ov as OverlayId, fid);
    if (info) {
      overlays.select(info.overlay, info.id);
      panel.showDetail(info);
    }
    selectionRestored = true;
  }

  // ── Map lifecycle ─────────────────────────────────────────────────────────
  map.on("style.load", () => {
    styleReady = true;
    refreshMap();
  });

  // If a hybrid satellite style was persisted, the map booted with imagery-only
  // (synchronous fallback); upgrade it to the hybrid (imagery + labels/roads).
  if (getStyle(initial.style).hybrid) void applyStyle(initial.style);

  // Graceful failure: surface tile/source errors without crashing.
  map.on("error", (e) => {
    const m = e.error?.message ?? "Unknown map error";
    // Tile fetch failures are common on flaky networks; keep them non-fatal.
    if (/tiles?|source|sprite|glyph/i.test(m)) {
      toast(`Map resource issue (non-fatal): ${m}`, "error", 5000);
    } else {
      // eslint-disable-next-line no-console
      console.warn("Map error:", m);
    }
  });

  // Persist camera to the URL hash (quietly — no UI re-render churn).
  map.on("moveend", () => {
    const c = map.getCenter();
    store.setCameraQuiet({
      center: [c.lng, c.lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    });
  });

  // ── Load overlay data (independent of the map being ready) ───────────────────
  void (async () => {
    // Constituencies route through the dedicated, licence-aware loader so the
    // empty-scaffold case shows a helpful message; the result is reflected via
    // the standard onLoadStatus path inside loadAll() too.
    await overlays.loadAll();
    dataLoaded = true;
    refreshMap();

    // If tracking was on before a refresh, start the (demo) feed now that the
    // roads data — which the simulation drives vehicles along — is available.
    if (store.get().tracking) startFeed();

    // Surface the constituency scaffold state explicitly.
    const con = await loadConstituencies();
    if (con.isEmptyScaffold) {
      panel.setStatus("constituencies", {
        loaded: true,
        count: 0,
        isEmptyScaffold: true,
      });
    }
  })();
}

bootstrap();

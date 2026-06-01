/**
 * main.ts — application entry point. Wires the map, controls, sidebar panel,
 * data loaders and the URL-hash state store together.
 */

import "./styles.css";
import type { Map as MLMap } from "maplibre-gl";

import { store } from "./state";
import type { OverlayId } from "./types";
import { getStyle } from "./config/basemap";
import { createMap, flyHome } from "./map/mapInit";
import { applyTerrain } from "./map/terrain";
import { OverlayManager, type SelectedFeatureInfo } from "./map/overlays";
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

  // ── Controls (style switcher / terrain / reset) ──────────────────────────────
  renderControls(controlsEl, {
    onStyleChange: (styleId) => {
      store.set({ style: styleId });
      styleReady = false;
      // Swapping the style wipes user sources/layers; refreshMap re-adds them
      // once the new style reports ready.
      map.setStyle(getStyle(styleId).style);
    },
    onTerrainToggle: (on) => {
      store.set({ terrain: on });
      applyTerrain(map, on);
    },
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

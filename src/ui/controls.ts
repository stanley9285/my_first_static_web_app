/**
 * controls.ts — top-left map controls: basemap style switcher, 3D terrain
 * toggle, and a reset/home button. All controls are keyboard-accessible with
 * ARIA labels.
 */

import { BASEMAP_STYLES } from "../config/basemap";
import { store } from "../state";

export interface ControlHandlers {
  onStyleChange: (styleId: string) => void;
  onTerrainToggle: (on: boolean) => void;
  onTrackingToggle: (on: boolean) => void;
  onHome: () => void;
}

export function renderControls(root: HTMLElement, handlers: ControlHandlers): void {
  const s = store.get();
  root.innerHTML = "";

  // ── Basemap style switcher ───────────────────────────────────────────────
  const styleGroup = document.createElement("div");
  styleGroup.className = "control-group";

  const styleLabel = document.createElement("label");
  styleLabel.className = "control-label";
  styleLabel.htmlFor = "style-select";
  styleLabel.textContent = "Basemap";

  const select = document.createElement("select");
  select.id = "style-select";
  select.setAttribute("aria-label", "Select basemap style");
  for (const st of BASEMAP_STYLES) {
    const opt = document.createElement("option");
    opt.value = st.id;
    opt.textContent = st.label;
    if (st.id === s.style) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => handlers.onStyleChange(select.value));

  styleGroup.append(styleLabel, select);

  // ── 3D terrain toggle ─────────────────────────────────────────────────────
  const terrainGroup = document.createElement("div");
  terrainGroup.className = "control-group control-row";

  const terrainBtn = document.createElement("button");
  terrainBtn.type = "button";
  terrainBtn.id = "terrain-toggle";
  terrainBtn.className = "toggle-btn";
  terrainBtn.setAttribute("role", "switch");
  terrainBtn.setAttribute("aria-checked", String(s.terrain));
  terrainBtn.setAttribute("aria-label", "Toggle 3D terrain");
  const setTerrainLabel = (on: boolean) => {
    terrainBtn.textContent = on ? "3D Terrain: On" : "3D Terrain: Off";
    terrainBtn.classList.toggle("on", on);
    terrainBtn.setAttribute("aria-checked", String(on));
  };
  setTerrainLabel(s.terrain);
  terrainBtn.addEventListener("click", () => {
    const next = terrainBtn.getAttribute("aria-checked") !== "true";
    setTerrainLabel(next);
    handlers.onTerrainToggle(next);
  });

  terrainGroup.appendChild(terrainBtn);

  // ── Live goods-vehicle tracking toggle ────────────────────────────────────
  const trackGroup = document.createElement("div");
  trackGroup.className = "control-group control-row";

  const trackBtn = document.createElement("button");
  trackBtn.type = "button";
  trackBtn.id = "tracking-toggle";
  trackBtn.className = "toggle-btn";
  trackBtn.setAttribute("role", "switch");
  trackBtn.setAttribute("aria-checked", String(s.tracking));
  trackBtn.setAttribute("aria-label", "Toggle live goods-vehicle tracking (demo)");
  const setTrackLabel = (on: boolean) => {
    trackBtn.innerHTML = on
      ? 'Track goods: On <span class="demo-badge">DEMO</span>'
      : "Track goods: Off";
    trackBtn.classList.toggle("on", on);
    trackBtn.setAttribute("aria-checked", String(on));
  };
  setTrackLabel(s.tracking);
  trackBtn.addEventListener("click", () => {
    const next = trackBtn.getAttribute("aria-checked") !== "true";
    setTrackLabel(next);
    handlers.onTrackingToggle(next);
  });

  trackGroup.appendChild(trackBtn);

  // ── Reset / home ──────────────────────────────────────────────────────────
  const homeBtn = document.createElement("button");
  homeBtn.type = "button";
  homeBtn.id = "home-btn";
  homeBtn.className = "toggle-btn";
  homeBtn.setAttribute("aria-label", "Reset to full Malawi view");
  homeBtn.textContent = "⤺ Reset view";
  homeBtn.addEventListener("click", () => handlers.onHome());

  const homeGroup = document.createElement("div");
  homeGroup.className = "control-group";
  homeGroup.appendChild(homeBtn);

  root.append(styleGroup, terrainGroup, trackGroup, homeGroup);

  // Keep toggle buttons in sync if state changes elsewhere.
  store.subscribe((st) => {
    if ((terrainBtn.getAttribute("aria-checked") === "true") !== st.terrain) {
      setTerrainLabel(st.terrain);
    }
    if ((trackBtn.getAttribute("aria-checked") === "true") !== st.tracking) {
      setTrackLabel(st.tracking);
    }
    if (select.value !== st.style) select.value = st.style;
  });
}

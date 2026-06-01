/**
 * panel.ts — the right-hand sidebar: overlay tabs, per-layer visibility
 * toggles, a searchable feature list, the licence-sensitivity notice for
 * constituencies, load/error status, and the selected-feature detail card.
 *
 * Pure DOM (no framework). Communicates with the app via callbacks.
 */

import type { OverlayCollection, OverlayId } from "../types";
import { OVERLAYS, getOverlay } from "../config/overlays";
import type { SelectedFeatureInfo } from "../map/overlays";

export interface PanelHandlers {
  onTabChange: (id: OverlayId) => void;
  onToggleVisibility: (id: OverlayId, on: boolean) => void;
  onSelectFeature: (id: OverlayId, featureId: string | number) => void;
  onCloseDetail: () => void;
}

interface OverlayStatus {
  loaded: boolean;
  count?: number;
  error?: string;
  isEmptyScaffold?: boolean;
}

export class PanelUI {
  private root: HTMLElement;
  private handlers: PanelHandlers;
  private activeTab: OverlayId;
  private visible: Record<OverlayId, boolean>;
  private status: Record<OverlayId, OverlayStatus> = {
    regions: { loaded: false },
    districts: { loaded: false },
    constituencies: { loaded: false },
    landforms: { loaded: false },
  };
  private data: Partial<Record<OverlayId, OverlayCollection>> = {};

  constructor(
    root: HTMLElement,
    initial: { activeTab: OverlayId; visible: Record<OverlayId, boolean> },
    handlers: PanelHandlers
  ) {
    this.root = root;
    this.handlers = handlers;
    this.activeTab = initial.activeTab;
    this.visible = { ...initial.visible };
    this.renderShell();
  }

  // ── public API ─────────────────────────────────────────────────────────────
  setStatus(id: OverlayId, status: OverlayStatus): void {
    this.status[id] = status;
    if (id === this.activeTab) this.renderTabBody();
  }

  setData(id: OverlayId, data: OverlayCollection): void {
    this.data[id] = data;
    if (id === this.activeTab) this.renderTabBody();
  }

  setActiveTab(id: OverlayId): void {
    this.activeTab = id;
    this.renderTabs();
    this.renderTabBody();
  }

  setVisibility(id: OverlayId, on: boolean): void {
    this.visible[id] = on;
    if (id === this.activeTab) this.renderTabBody();
  }

  showDetail(info: SelectedFeatureInfo): void {
    const card = this.root.querySelector<HTMLElement>("#detail-card");
    if (!card) return;
    const cfg = getOverlay(info.overlay);

    const rows: Array<[string, string]> = [];
    let note = "";

    if (info.overlay === "landforms") {
      // Natural feature: show category, elevation, region, then a description.
      if (info.featureType) rows.push(["Type", capitalize(info.featureType)]);
      if (info.region) rows.push(["Region", info.region]);
      if (typeof info.elevation === "number") {
        rows.push(["Elevation", `${info.elevation.toLocaleString()} m`]);
      }
      if (info.description) note = info.description;
    } else {
      // Administrative boundary: type + parents + placeholder stat fields.
      rows.push(["Type", SINGULAR[info.overlay]]);
      if (info.region) rows.push(["Region", info.region]);
      if (info.district) rows.push(["District", info.district]);
      rows.push(["Population", "—"]);
      rows.push(["Area (km²)", "—"]);
      rows.push(["Feature ID", String(info.id)]);
      note = "Stat fields are placeholders — connect a data source to populate them.";
    }

    card.innerHTML = `
      <div class="detail-head" style="border-color:${cfg.color}">
        <h3>${escapeHtml(info.name)}</h3>
        <button type="button" id="detail-close" aria-label="Close details">✕</button>
      </div>
      <dl class="detail-grid">
        ${rows
          .map(
            ([k, v]) =>
              `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`
          )
          .join("")}
      </dl>
      ${note ? `<p class="detail-note">${escapeHtml(note)}</p>` : ""}
    `;
    card.hidden = false;
    card
      .querySelector("#detail-close")
      ?.addEventListener("click", () => this.handlers.onCloseDetail());
  }

  clearDetail(): void {
    const card = this.root.querySelector<HTMLElement>("#detail-card");
    if (card) {
      card.hidden = true;
      card.innerHTML = "";
    }
  }

  // ── rendering ───────────────────────────────────────────────────────────────
  private renderShell(): void {
    this.root.innerHTML = `
      <header class="sidebar-head">
        <h1>Malawi</h1>
        <p class="subtitle">Boundaries &amp; landforms</p>
      </header>
      <div class="tabs" role="tablist" aria-label="Overlay layers"></div>
      <div class="tab-body" id="tab-body" role="tabpanel"></div>
      <section class="detail-card" id="detail-card" aria-live="polite" hidden></section>
    `;
    this.renderTabs();
    this.renderTabBody();
  }

  private renderTabs(): void {
    const tabs = this.root.querySelector<HTMLElement>(".tabs");
    if (!tabs) return;
    tabs.innerHTML = "";
    for (const o of OVERLAYS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab" + (o.id === this.activeTab ? " active" : "");
      btn.id = `tab-${o.id}`;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(o.id === this.activeTab));
      btn.setAttribute("aria-controls", "tab-body");
      btn.textContent = o.label;
      // A dot indicates the layer is currently shown on the map.
      if (this.visible[o.id]) {
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = o.color;
        dot.setAttribute("aria-hidden", "true");
        btn.appendChild(dot);
      }
      btn.addEventListener("click", () => this.handlers.onTabChange(o.id));
      tabs.appendChild(btn);
    }
  }

  private renderTabBody(): void {
    const body = this.root.querySelector<HTMLElement>("#tab-body");
    if (!body) return;
    const cfg = getOverlay(this.activeTab);
    const st = this.status[this.activeTab];
    body.innerHTML = "";

    // Visibility toggle
    const toggleRow = document.createElement("label");
    toggleRow.className = "show-toggle";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = this.visible[this.activeTab];
    cb.setAttribute("aria-label", `Show ${cfg.label} on map`);
    cb.addEventListener("change", () =>
      this.handlers.onToggleVisibility(this.activeTab, cb.checked)
    );
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = cfg.color;
    const txt = document.createElement("span");
    txt.textContent = `Show ${cfg.label} on map`;
    toggleRow.append(cb, swatch, txt);
    body.appendChild(toggleRow);

    // Licence warning (constituencies)
    if (cfg.licenseWarning) {
      const warn = document.createElement("div");
      warn.className = "license-warning";
      warn.setAttribute("role", "note");
      warn.innerHTML = `<strong>⚠ Licensing</strong> ${escapeHtml(cfg.licenseWarning)}`;
      body.appendChild(warn);
    }

    // Status line
    const status = document.createElement("p");
    status.className = "status-line";
    if (!st.loaded && !st.error) {
      status.textContent = "Loading…";
    } else if (st.error) {
      status.classList.add("error");
      status.textContent = `Could not load ${cfg.label}: ${st.error}`;
    } else if (st.isEmptyScaffold || st.count === 0) {
      status.classList.add("muted");
      status.innerHTML =
        "No geometry bundled. Drop a licence-cleared GeoJSON at " +
        "<code>public/data/constituencies-MWI.geojson</code> — see README.";
    } else {
      status.textContent = `${st.count} ${st.count === 1 ? "feature" : "features"} loaded`;
    }
    body.appendChild(status);

    // Feature list
    const data = this.data[this.activeTab];
    if (data && data.features.length) {
      const list = document.createElement("ul");
      list.className = "feature-list";
      list.setAttribute("aria-label", `${cfg.label} list`);
      const sorted = [...data.features].sort((a, b) =>
        (a.properties.name ?? "").localeCompare(b.properties.name ?? "")
      );
      for (const f of sorted) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "feature-item";
        btn.textContent = f.properties.name ?? "(unnamed)";
        if (f.properties.region) {
          const meta = document.createElement("span");
          meta.className = "feature-meta";
          meta.textContent = f.properties.region;
          btn.appendChild(meta);
        }
        const fid = f.id ?? f.properties.id;
        btn.addEventListener("click", () =>
          this.handlers.onSelectFeature(this.activeTab, fid)
        );
        li.appendChild(btn);
        list.appendChild(li);
      }
      body.appendChild(list);
    }

    // Attribution note for this overlay (also shown in the on-map control)
    if (cfg.attribution) {
      const attr = document.createElement("p");
      attr.className = "overlay-attr";
      attr.innerHTML = cfg.attribution;
      body.appendChild(attr);
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}

const SINGULAR: Record<OverlayId, string> = {
  regions: "Region",
  districts: "District",
  constituencies: "Constituency",
  landforms: "Landform",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

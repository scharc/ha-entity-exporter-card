// Entity Exporter Card for Home Assistant
// Version: 1.1.0
// Author: scharc (https://github.com/scharc)
// License: MIT
// Created using "vibe coding" - collaborative AI-assisted development

// Version info for debugging
const CARD_VERSION = "1.1.0";
console.log("[HA Entity Exporter] Loading version:", CARD_VERSION);


// Make sure the card is registered with Home Assistant
console.log("[HA Entity Exporter] Registering custom card");

// Get Home Assistant's internal libraries
// Find a HA card element that definitely exists
const HaCard = customElements.get("hui-entities-card");
if (!HaCard) {
  throw new Error("Cannot find Home Assistant card elements. This may be due to a Home Assistant version change.");
}

// Get the LitElement base class and its methods
const LitElement = Object.getPrototypeOf(HaCard);
const html = LitElement.prototype.html;

// CSS needs special handling
console.log("[HA Entity Exporter] Setting up styles");

class HaEntityExporterCard extends LitElement {
  // Define styles directly as a static property
  static get styles() {
    return [
      LitElement.prototype.styles || [],
      LitElement.prototype.css ? LitElement.prototype.css`
        :host {
          display: block;
          font-family: sans-serif;
          background: #1e1e1e;
          color: white;
          padding: 1rem;
          border-radius: 8px;
          box-shadow: 0 0 6px rgba(0, 0, 0, 0.4);
        }
        h2 {
          margin: 0 0 1rem;
        }
        input,
        button {
          font-size: 0.9rem;
          padding: 0.3rem;
          border: none;
          border-radius: 4px;
        }
        input {
          flex: 1;
          margin-right: 0.3rem;
        }
        .filter-controls,
        .domain-controls,
        .button-row {
          display: flex;
          gap: 0.3rem;
          flex-wrap: wrap;
          margin-bottom: 0.5rem;
        }
        .filter-status {
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
          color: #aaa;
        }
        .live-filter-indicator {
          font-style: italic;
          color: #6af;
        }
        .tags {
          display: flex;
          gap: 0.3rem;
          flex-wrap: wrap;
          margin-bottom: 0.5rem;
        }
        .tag {
          background: #333;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
        }
        .tag:hover {
          background: #444;
        }
        .preview {
          max-height: 250px;
          overflow-y: auto;
          background: #111;
          padding: 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
        }
        .bold {
          font-weight: bold;
          margin-top: 0.5rem;
        }
        .button-row button.success {
          background: #3a3;
          color: white;
        }
        .button-row button.error {
          background: #a33;
          color: white;
        }
      ` : null
    ].filter(Boolean);
  }

  // Define properties to observe for changes
  static get properties() {
    return {
      _config: { state: true },
      _hass: { state: true },
      filters: { state: true },
      selectedDomains: { state: true },
      previewList: { state: true },
      allDomains: { state: true },
      tempFilter: { state: true },
      copyState: { state: true },
      downloadState: { state: true },
      hasClipboardSupport: { state: true },
    };
  }

  // Required for Home Assistant to configure the card
  setConfig(config) {
    console.log("[HA Entity Exporter] Card config set:", config);
    this._config = config;
  }

  // Home Assistant will provide hass object
  set hass(hass) {
    this._hass = hass;
    this.requestUpdate();
  }

  constructor() {
    super();
    this._config = {};
    this._hass = null;
    this.filters = [];
    this.selectedDomains = new Set();
    this.previewList = [];
    this.tempFilter = "";
    this.copyState = "idle";
    this.downloadState = "idle";
    this.hasClipboardSupport = false;
    this.allDomains = [
      "sensor",
      "binary_sensor",
      "switch",
      "light",
      "input_boolean",
      "input_number",
      "input_select",
      "input_text",
      "input_datetime",
      "counter",
      "timer",
      "media_player",
      "script",
      "automation",
      "climate",
      "cover",
      "fan",
      "vacuum",
      "calendar",
      "button",
      "device_tracker",
      "zone",
      "person",
    ];
    this.allDomains.forEach((d) => this.selectedDomains.add(d));
  }

  connectedCallback() {
    super.connectedCallback();
    // Check if clipboard API is supported
    this.hasClipboardSupport = typeof navigator.clipboard !== 'undefined' && 
                              typeof navigator.clipboard.writeText === 'function';
    console.log("[HA Entity Exporter] Card connected, clipboard support:", this.hasClipboardSupport);
  }

  render() {
    if (!this._hass) {
      return html`<div>Loading Home Assistant...</div>`;
    }

    // Get the count of filtered entities for the UI
    const filteredEntities = this.groupedPreview().reduce(
      (total, group) => total + group.ids.length, 
      0
    );
    
    // Calculate total entities in selected domains
    const totalAvailableEntities = Object.entries(this._hass.states)
      .filter(([id]) => this.selectedDomains.has(id.split(".")[0]))
      .length;

    return html`
      <h2>Entity Exporter</h2>

      <div class="filter-controls">
        <input
          .value=${this.tempFilter}
          @input=${this.handleFilterInput}
          placeholder="Filter entities..."
        />
        <button @click=${this.addFilter}>Add Filter</button>
      </div>
      
      <div class="filter-status">
        Showing ${filteredEntities} of ${totalAvailableEntities} entities
        ${this.tempFilter ? html`
          <span class="live-filter-indicator">
            (matching: "${this.tempFilter}")
          </span>
        ` : ''}
      </div>
      
      <div class="tags">
        ${this.filters.map(
          (f, i) =>
            html`<span class="tag" @click=${() => this.removeFilter(i)}
              >${f} ✕</span
            >`
        )}
      </div>

      <div class="domain-controls">
        <button @click=${this.selectAll}>All</button>
        <button @click=${this.selectNone}>None</button>
        <button @click=${this.invertSelection}>Invert</button>
      </div>

      <div class="tags">
        ${this.allDomains.map(
          (domain) => html`
            <label>
              <input
                type="checkbox"
                .checked=${this.selectedDomains.has(domain)}
                @change=${(e) => this.toggleDomain(domain, e.target.checked)}
              />
              ${domain}
            </label>
          `
        )}
      </div>

      <div class="preview">
        ${this.groupedPreview().map(
          ({ domain, ids }) => html`
            <div class="bold">${domain} (${ids.length})</div>
            ${ids.map((id) => html`<div>${id}</div>`)}
          `
        )}
      </div>

      <div class="button-row">
        ${this.hasClipboardSupport ? html`
          <button class=${this.copyState} @click=${this.copyToClipboard}>
            📋 Copy
          </button>
        ` : ''}
        <button class=${this.downloadState} @click=${this.downloadJson}>
          ⬇ Download
        </button>
      </div>
    `;
  }

  // Fix input losing focus by handling input separately and enabling live filtering
  handleFilterInput(e) {
    this.tempFilter = e.target.value;
    // Request update to refresh the preview with the live filter
    this.requestUpdate();
  }

  addFilter() {
    const f = this.tempFilter.trim();
    if (f && !this.filters.includes(f)) {
      this.filters = [...this.filters, f];
    }
    this.tempFilter = "";
  }

  removeFilter(index) {
    this.filters = this.filters.filter((_, i) => i !== index);
  }

  selectAll() {
    this.selectedDomains = new Set(this.allDomains);
  }

  selectNone() {
    this.selectedDomains = new Set();
  }

  invertSelection() {
    const next = new Set();
    this.allDomains.forEach((d) => {
      if (!this.selectedDomains.has(d)) next.add(d);
    });
    this.selectedDomains = next;
  }

  toggleDomain(domain, checked) {
    if (checked) this.selectedDomains.add(domain);
    else this.selectedDomains.delete(domain);
    this.selectedDomains = new Set(this.selectedDomains);
  }

  groupedPreview() {
    if (!this._hass?.states) return [];
    
    // Get temporary filter for live filtering
    const tempFilterValue = this.tempFilter.trim();
    
    const out = {};
    Object.entries(this._hass.states).forEach(([id, obj]) => {
      // STEP 1: Apply domain filters first
      const domain = id.split(".")[0];
      if (!this.selectedDomains.has(domain)) return;
      
      // STEP 2: Apply text filters (if any exist)
      // If no saved filters and no temp filter, include all domain-filtered entities
      if (this.filters.length === 0 && !tempFilterValue) {
        // No text filters, include all entities from selected domains
        if (!out[domain]) out[domain] = [];
        out[domain].push(id);
        return;
      }
      
      // STEP 3: With text filters, entity must match at least one filter
      let matchAnyFilter = false;
      
      // Check against saved filters (OR relationship)
      if (this.filters.length > 0) {
        matchAnyFilter = this.filters.some(f => id.toLowerCase().includes(f.toLowerCase()));
      }
      
      // If typing in the temporary filter, only show matches for that filter
      if (tempFilterValue) {
        // If we already have filters, show only temp filter matches
        // If no existing filters, show only temp filter matches
        matchAnyFilter = id.toLowerCase().includes(tempFilterValue.toLowerCase());
      }
      
      // Add entity if it matches any filter
      if (matchAnyFilter) {
        if (!out[domain]) out[domain] = [];
        out[domain].push(id);
      }
    });
    
    return Object.entries(out)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([domain, ids]) => ({ domain, ids: ids.sort() }));
  }

  prepareExport() {
    const result = {};
    const filtered = this.groupedPreview().flatMap((g) => g.ids);
    filtered.forEach((id) => {
      const obj = this._hass.states[id];
      const attrs = Object.entries(obj.attributes).slice(0, 10);
      result[id] = {
        state: obj.state,
        attributes: Object.fromEntries(attrs),
      };
    });
    return result;
  }

  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(this.prepareExport(), null, 2)
      );
      this.copyState = "success";
      setTimeout(() => (this.copyState = "idle"), 1500);
    } catch (e) {
      console.error(e);
      this.copyState = "error";
      setTimeout(() => (this.copyState = "idle"), 2000);
    }
  }

  downloadJson() {
    try {
      const blob = new Blob([JSON.stringify(this.prepareExport(), null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ha-entities-export.json";
      a.click();
      this.downloadState = "success";
      setTimeout(() => (this.downloadState = "idle"), 1500);
    } catch (e) {
      console.error(e);
      this.downloadState = "error";
      setTimeout(() => (this.downloadState = "idle"), 2000);
    }
  }
}

// First register the custom element
customElements.define("entity-exporter-card", HaEntityExporterCard);

// Then register the card with Lovelace
console.log("[HA Entity Exporter] Card tools not found, using fallback registration");

// Lovelace card registration
window.customCards = window.customCards || [];
window.customCards.push({
  type: "entity-exporter-card",
  name: "Entity Exporter",
  description: "Filter and export Home Assistant entities.",
  preview: false,
  version: CARD_VERSION
});

// Log successful registration
console.log("[HA Entity Exporter] Card registered with type: entity-exporter-card");

// Notify Home Assistant about the new card
try {
  const event = new Event("ll-rebuild");
  window.dispatchEvent(event);
  console.log("[HA Entity Exporter] Sent rebuild event to Home Assistant");
} catch (e) {
  console.warn("[HA Entity Exporter] Failed to dispatch event:", e);
}

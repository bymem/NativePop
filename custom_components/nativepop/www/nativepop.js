// NativePop — Milestones 1-4 proof of concept
//
// Milestone 1: hardcoded direct-trigger card that fetches one manually-created
// hidden dashboard's config and mounts it via HA's internal `hui-view` inside
// a dialog.
// Milestone 2: a global hashchange/popstate listener opens the same dialog
// when navigating to "#popup-<slug>" (deep link, back-button aware).
// Milestone 3: generalizes both trigger paths so they're slug-driven instead
// of hardcoded, and makes the direct trigger usable from ANY card's
// tap_action (native or custom) without a wrapper card — resolving spec
// open question 9.1 in favor of the generic-action approach:
//
//   tap_action:
//     action: fire-dom-event
//     nativepop_popup: popup-test
//
// This works because HA's own `fire-dom-event` action dispatches a
// `CustomEvent("ll-custom", { bubbles: true, composed: true, detail: <actionConfig> })`
// on the card element (see src/panels/lovelace/common/handle-action.ts) — any
// card that uses HA's shared action handler gets this for free. A handful of
// custom cards hand-roll their own click handling and won't fire it; that's a
// known limitation of the mechanism itself, not something we can fix here.
//
// The navigation trigger also picked up a real bug fix this milestone: real
// `tap_action: navigate` calls `history.pushState()` internally, which never
// fires `hashchange` or `popstate` (standard browser behavior). HA works
// around that by firing its own `"location-changed"` event on `window` after
// every navigate() call (see src/common/navigate.ts) — we now listen for
// that too, otherwise a real `navigation_path: "#popup-<slug>"` tap would
// have silently done nothing.
//
// In practice `tap_action: navigate` to a "#popup-<slug>" hash is the
// recommended tap-trigger for real dashboards (tile cards, navbar cards,
// etc.) — it's fully visual-editor friendly. `fire-dom-event` above still
// works, but HA hid it from the visual action picker some releases back
// (YAML-only now), so it's kept as a working fallback rather than the
// primary path.
//
// Also new this milestone: automation-triggered popups, with no tap at all —
// e.g. a security automation opening a popup on its own. HA has a built-in,
// visually-editable "Fire an event" action that needs no custom backend
// integration (docs: home-assistant.io/docs/scripts/#fire-an-event):
//
//   actions:
//     - event: nativepop_open_popup
//       event_data:
//         popup: popup-security
//
// We subscribe to that event type over the same websocket connection `hass`
// already uses. This broadcasts to every connected frontend session (same
// as any other HA event) — there's no per-browser/per-user targeting in v1.
//
// Milestone 4: sidebar panel ("Popup Manager"), plus a delivery pivot — this
// file is now served by the NativePop *integration*
// (custom_components/nativepop/), not a HACS "plugin"/Lovelace-resource
// install. The integration's frontend.py auto-loads this module on every
// frontend page via `add_extra_js_url()` (so the trigger listeners are
// always live, no manual "add resource" step) and registers the sidebar
// panel via `panel_custom.async_register_panel()` (so no manual
// configuration.yaml entry either) — both self-register the moment the
// integration's (config-free) config flow is confirmed. List/create/delete
// only in v1, naming-convention based (any dashboard whose url_path starts
// with "popup-" counts, per spec 5.6 — no backend/metadata registry).
// Rename is milestone 5.

const POPUP_URL_PATH_PREFIX = "popup-";
const POPUP_HASH_PREFIX = `#${POPUP_URL_PATH_PREFIX}`;
const DEFAULT_POPUP_URL_PATH = "popup-test"; // fallback for the PoC card only

let currentDialog = null;
let currentPopupUrlPath = null;
let dialogOpenedViaHash = false;
let dialogPushedByUs = false;
let weSetHashOurselves = false;

// The trigger card only has a `hass` while it's connected to a dashboard.
// Both the hash listener and the ll-custom listener have to work even when
// no NativePop card is on screen (a true deep link, or a tap on some
// unrelated native card), so they read `hass` straight off HA's root element
// instead — a well-known but undocumented escape hatch, same category of
// internal dependency as `hui-view` itself (see spec section 7).
function getHass() {
  const haEl = document.querySelector("home-assistant");
  return haEl ? haEl.hass : undefined;
}

// After a programmatic history.pushState(), HA's own router needs this event
// to notice the URL changed and re-render (same event navigate() fires
// itself — see src/common/navigate.ts, and the file header above).
function fireLocationChanged() {
  window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
}

// "#popup-<slug>" -> "popup-<slug>" (the dashboard's url_path, per spec 5.1
// the slug IS the url_path, used verbatim as the hash too). Returns null for
// anything else.
function matchPopupUrlPath(hash) {
  if (hash && hash.startsWith(POPUP_HASH_PREFIX) && hash.length > POPUP_HASH_PREFIX.length) {
    return hash.slice(1);
  }
  return null;
}

async function openNativePopDialog(hass, popupUrlPath, { viaHash = false, pushedByUs = false } = {}) {
  if (currentDialog) {
    if (currentPopupUrlPath !== popupUrlPath) {
      console.warn(
        `NativePop: popup "${popupUrlPath}" requested while "${currentPopupUrlPath}" is already open — ignoring (one popup at a time in v1)`
      );
    }
    return;
  }
  if (!hass) {
    console.error("NativePop: no hass object available yet");
    return;
  }

  let lovelaceConfig;
  try {
    // Same WS command HA's own frontend uses to fetch a non-default
    // dashboard's config (see src/data/lovelace.ts -> fetchConfig).
    lovelaceConfig = await hass.callWS({
      type: "lovelace/config",
      url_path: popupUrlPath,
    });
  } catch (err) {
    console.error(`NativePop: could not fetch dashboard config for "${popupUrlPath}"`, err);
    alert(`NativePop: could not load popup dashboard "${popupUrlPath}". See console for details.`);
    return;
  }

  // Minimal but structurally correct `Lovelace` object — matches the shape
  // hui-view/hui-root expect (config, rawConfig, editMode, urlPath, mode,
  // locale, plus the edit/save/toast callbacks). We're read-only for the
  // PoC, so the mutating callbacks are no-ops.
  const lovelace = {
    config: lovelaceConfig,
    rawConfig: lovelaceConfig,
    editMode: false,
    urlPath: popupUrlPath,
    mode: "storage",
    locale: hass.locale,
    enableFullEditMode: () => {},
    setEditMode: () => {},
    saveConfig: async () => {},
    deleteConfig: async () => {},
    showToast: () => {},
  };

  const dialog = document.createElement("ha-dialog");
  dialog.heading = "NativePop";
  dialog.open = true;

  const view = document.createElement("hui-view");
  view.hass = hass;
  view.lovelace = lovelace;
  view.index = 0; // popup dashboards are single-view (spec 5.1)
  view.narrow = false;

  dialog.appendChild(view);

  currentDialog = dialog;
  currentPopupUrlPath = popupUrlPath;
  dialogOpenedViaHash = viaHash;
  dialogPushedByUs = pushedByUs;

  // ha-dialog (mwc-dialog) fires "closed" on any close path (X, ESC, outside
  // click, or us setting .open = false).
  dialog.addEventListener("closed", () => {
    dialog.remove();
    currentDialog = null;
    currentPopupUrlPath = null;

    const wasViaHash = dialogOpenedViaHash;
    const wasPushedByUs = dialogPushedByUs;
    dialogOpenedViaHash = false;
    dialogPushedByUs = false;

    if (!wasViaHash || matchPopupUrlPath(location.hash) !== popupUrlPath) {
      // Direct trigger, or the hash already changed (e.g. the user hit
      // back, which is what closed us in the first place) - nothing to revert.
      return;
    }

    if (wasPushedByUs) {
      // We added this hash to the history stack ourselves (nav-trigger
      // button/tap_action) -> closing the dialog should behave like pressing back.
      history.back();
    } else {
      // Hash was already there when we picked it up (cold-load deep link) —
      // strip it without touching history so we don't navigate outside the app.
      history.replaceState(null, "", location.pathname + location.search);
    }
  });

  document.body.appendChild(dialog);
}

function closeNativePopDialog() {
  if (currentDialog) {
    currentDialog.open = false;
  }
}

// Shared by hashchange, popstate, AND location-changed (see file header for
// why all three are needed).
function handleLocationChange() {
  const targetPopup = matchPopupUrlPath(location.hash);
  if (targetPopup) {
    if (!currentDialog) {
      const pushedByUs = weSetHashOurselves;
      weSetHashOurselves = false;
      openNativePopDialog(getHass(), targetPopup, { viaHash: true, pushedByUs });
    }
  } else if (currentDialog && dialogOpenedViaHash) {
    closeNativePopDialog();
  }
}

window.addEventListener("hashchange", handleLocationChange);
window.addEventListener("popstate", handleLocationChange);
window.addEventListener("location-changed", handleLocationChange);

// Generalized direct trigger: any card's tap_action (native or custom) can
// open a popup with:
//   tap_action: { action: fire-dom-event, nativepop_popup: "popup-<slug>" }
// No wrapper card required.
window.addEventListener("ll-custom", (ev) => {
  const popupUrlPath = ev.detail && ev.detail.nativepop_popup;
  if (popupUrlPath) {
    openNativePopDialog(getHass(), popupUrlPath, { viaHash: false });
  }
});

// Handle a cold load where the URL already has "#popup-<slug>" in it (a real
// deep link opened fresh). `hass` might not exist on the root element yet at
// this point, so retry briefly instead of giving up immediately.
(function openFromInitialHash() {
  const targetPopup = matchPopupUrlPath(location.hash);
  if (!targetPopup) {
    return;
  }
  let attempts = 0;
  const tick = () => {
    const hass = getHass();
    if (hass) {
      openNativePopDialog(hass, targetPopup, { viaHash: true, pushedByUs: false });
      return;
    }
    attempts += 1;
    if (attempts < 20) {
      setTimeout(tick, 250);
    } else {
      console.warn("NativePop: gave up waiting for hass to open popup from initial hash");
    }
  };
  tick();
})();

const NATIVEPOP_EVENT_TYPE = "nativepop_open_popup";

// Automation-triggered popups (see file header) — subscribe once `hass` (and
// its websocket connection) is available, then leave the subscription alive
// for the page's lifetime. home-assistant-js-websocket re-subscribes
// automatically after a reconnect, so this doesn't need to be redone.
(function subscribeToPopupEvents() {
  let attempts = 0;
  const tick = () => {
    const hass = getHass();
    if (hass && hass.connection) {
      hass.connection.subscribeEvents((event) => {
        const popupUrlPath = event.data && event.data.popup;
        if (popupUrlPath) {
          openNativePopDialog(getHass(), popupUrlPath, { viaHash: false });
        }
      }, NATIVEPOP_EVENT_TYPE);
      return;
    }
    attempts += 1;
    if (attempts < 20) {
      setTimeout(tick, 250);
    } else {
      console.warn("NativePop: gave up waiting for hass to subscribe to popup events");
    }
  };
  tick();
})();

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Sidebar panel: list / create / delete popups. Registered as
// <nativepop-panel> by the integration's frontend.py (no manual YAML). HA
// sets `.hass` (repeatedly, on every state change) and `.panel` (the
// panel_custom config) on this element.
class NativePopPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._initialized = true;
      this._init();
    }
  }

  set panel(panel) {
    this._panel = panel;
  }

  _init() {
    this.innerHTML = `
      <style>
        :host { display: block; height: 100%; box-sizing: border-box; overflow: auto; }
        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px; border-bottom: 1px solid var(--divider-color);
        }
        .header h1 { font-size: 20px; margin: 0; }
        .list { padding: 16px; max-width: 600px; margin: 0 auto; }
        .popup-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px;
          padding: 12px 16px; margin-bottom: 8px;
          border: 1px solid var(--divider-color); border-radius: 8px;
        }
        .popup-row .info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .popup-row .info span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .popup-row .url-path { font-family: monospace; font-size: 12px; color: var(--secondary-text-color); }
        .popup-row .actions { flex-shrink: 0; }
        .empty { padding: 32px 16px; text-align: center; color: var(--secondary-text-color); }
      </style>
      <div class="header">
        <h1>Popup Manager</h1>
        <mwc-button raised id="create-btn">+ New popup</mwc-button>
      </div>
      <div class="list" id="list">Loading…</div>
    `;

    this.querySelector("#create-btn").addEventListener("click", () => this._createPopup());

    this._refresh();
  }

  async _refresh() {
    const listEl = this.querySelector("#list");

    let dashboards;
    try {
      dashboards = await this._hass.callWS({ type: "lovelace/dashboards/list" });
    } catch (err) {
      console.error("NativePop: could not list dashboards", err);
      listEl.textContent = "Could not load popups. See console for details.";
      return;
    }

    const popups = dashboards
      .filter((d) => d.url_path && d.url_path.startsWith(POPUP_URL_PATH_PREFIX))
      .sort((a, b) => a.title.localeCompare(b.title));

    if (popups.length === 0) {
      listEl.innerHTML = `<div class="empty">No popups yet — create one to get started.</div>`;
      return;
    }

    listEl.innerHTML = "";
    for (const popup of popups) {
      const row = document.createElement("div");
      row.className = "popup-row";
      row.innerHTML = `
        <div class="info">
          <span>${this._escape(popup.title)}</span>
          <span class="url-path">#${this._escape(popup.url_path)}</span>
        </div>
        <div class="actions">
          <mwc-button dense class="edit-btn">Edit</mwc-button>
          <mwc-button dense class="delete-btn">Delete</mwc-button>
        </div>
      `;
      row.querySelector(".edit-btn").addEventListener("click", () => this._editPopup(popup));
      row.querySelector(".delete-btn").addEventListener("click", () => this._deletePopup(popup));
      listEl.appendChild(row);
    }
  }

  _escape(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Opens the dashboard's native editor directly (spec 5.2) via HA's own
  // "?edit=1" query param convention (src/panels/lovelace/hui-root.ts).
  _editPopup(popup) {
    history.pushState(null, "", `/${popup.url_path}?edit=1`);
    fireLocationChanged();
  }

  async _createPopup() {
    const title = prompt('Popup name (e.g. "Washing machine"):');
    if (!title) {
      return;
    }
    const slug = slugify(title);
    if (!slug) {
      alert("NativePop: please use a name with at least one letter or number.");
      return;
    }
    const urlPath = `${POPUP_URL_PATH_PREFIX}${slug}`;

    let dashboards;
    try {
      dashboards = await this._hass.callWS({ type: "lovelace/dashboards/list" });
    } catch (err) {
      console.error("NativePop: could not check existing popups", err);
      alert("NativePop: could not create popup. See console for details.");
      return;
    }
    if (dashboards.some((d) => d.url_path === urlPath)) {
      alert(`NativePop: a popup with url_path "${urlPath}" already exists. Try a different name.`);
      return;
    }

    try {
      await this._hass.callWS({
        type: "lovelace/dashboards/create",
        url_path: urlPath,
        mode: "storage",
        title,
        icon: "mdi:window-restore",
        show_in_sidebar: false,
        require_admin: false,
      });
    } catch (err) {
      console.error("NativePop: could not create popup dashboard", err);
      alert("NativePop: could not create popup. See console for details.");
      return;
    }

    // Dashboard creation doesn't let you set the view type - default it to a
    // single "sections" view per spec 5.1. Non-fatal if this fails; the
    // dashboard still exists, just with whatever HA's own fallback view is.
    try {
      await this._hass.callWS({
        type: "lovelace/config/save",
        url_path: urlPath,
        config: { views: [{ title, type: "sections", sections: [] }] },
      });
    } catch (err) {
      console.warn("NativePop: created popup but could not set its default view to sections", err);
    }

    await this._refresh();
    history.pushState(null, "", `/${urlPath}?edit=1`);
    fireLocationChanged();
  }

  async _deletePopup(popup) {
    if (!confirm(`Delete popup "${popup.title}"? This cannot be undone.`)) {
      return;
    }
    try {
      await this._hass.callWS({ type: "lovelace/dashboards/delete", dashboard_id: popup.id });
    } catch (err) {
      console.error("NativePop: could not delete popup dashboard", err);
      alert("NativePop: could not delete popup. See console for details.");
      return;
    }
    await this._refresh();
  }
}

customElements.define("nativepop-panel", NativePopPanel);

// Test harness card: configurable `popup:` slug, one button per trigger
// path, each going through the SAME generic mechanism a plain native card
// would use (dispatching ll-custom / setting location.hash) rather than
// calling the internal functions directly — so this also validates the
// listeners above, not just the dialog mount itself.
class NativePopPocCard extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this._popup = this._config.popup || DEFAULT_POPUP_URL_PATH;
  }

  set hass(hass) {
    this._hass = hass;
  }

  connectedCallback() {
    if (this._rendered) {
      return;
    }
    this._rendered = true;

    this.innerHTML = `
      <ha-card header="NativePop PoC">
        <div style="padding: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
          <mwc-button raised id="direct-btn">Open popup (direct)</mwc-button>
          <mwc-button raised id="hash-btn">Open popup (navigate hash)</mwc-button>
        </div>
      </ha-card>
    `;

    this.querySelector("#direct-btn").addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("ll-custom", {
          detail: { action: "fire-dom-event", nativepop_popup: this._popup },
          bubbles: true,
          composed: true,
        })
      );
    });

    this.querySelector("#hash-btn").addEventListener("click", () => {
      weSetHashOurselves = true;
      location.hash = this._popup; // handleLocationChange() does the actual opening
    });
  }

  getCardSize() {
    return 2;
  }
}

customElements.define("nativepop-poc-card", NativePopPocCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "nativepop-poc-card",
  name: "NativePop PoC",
  description: "Milestone 1-3 proof of concept trigger for NativePop popups.",
});

console.info("NativePop: milestone 4 loaded (integration-based delivery, PoC card + Popup Manager panel)");

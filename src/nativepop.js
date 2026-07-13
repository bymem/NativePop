// NativePop — Milestones 1-5 proof of concept
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
//
// Milestone 5 (polish): rename support; dialog loading state + widened
// sizing; close-on-outside-click (already ha-dialog's default); create/rename
// moved off prompt() onto a real dialog (ha-dialog + ha-form + ha-dialog-footer
// + ha-button, matching dialog-lovelace-dashboard-detail.ts); click-to-copy on
// each row's url_path/hash.
//
// The Popup Manager panel's list went through a real architecture change
// partway through milestone 5: it started as hand-rolled bordered divs, then
// plain divs styled to look like a list (after ha-list/ha-list-item's meta
// slot turned out not to render reliably), but Mikkel kept pointing back to
// the same lesson - stop approximating the native "Manage dashboards" page
// (ha-config-lovelace-dashboards.ts), use its actual components. That page's
// list is a `hass-tabs-subpage-data-table` wrapping `ha-data-table`, with
// built-in sortable columns, click-to-open rows, an overflow menu per row,
// AND a built-in search box — exactly the "add search" ask too.
//
// The catch: `ha-data-table` columns that render anything beyond plain text
// (icons, the overflow menu) require a `column.template` function returning
// a real Lit `TemplateResult` - a plain HTML string gets auto-escaped as
// literal text by Lit's XSS protection, not parsed as markup. That needs
// `lit-html`'s `html` tag, which isn't available without a bundler. This is
// the reason this project now has a build step (esbuild, see package.json) -
// everything else in this file is still plain, dependency-free JS; `lit-html`
// is used *only* for the handful of `column.template` callbacks below.
import { html } from "lit-html";

const POPUP_URL_PATH_PREFIX = "popup-";
const POPUP_HASH_PREFIX = `#${POPUP_URL_PATH_PREFIX}`;
const DEFAULT_POPUP_URL_PATH = "popup-test"; // fallback for the PoC card only

// Real MDI SVG path data (from @mdi/js / @mdi/svg), needed because
// ha-icon-overflow-menu's `items[].path` field requires raw path data, not
// an "mdi:name" string the way ha-icon-button's slot fallback accepts.
const ICON_PATHS = {
  pencil:
    "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z",
  renameBox:
    "M18,17H10.5L12.5,15H18M6,17V14.5L13.88,6.65C14.07,6.45 14.39,6.45 14.59,6.65L16.35,8.41C16.55,8.61 16.55,8.92 16.35,9.12L8.47,17M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z",
  deleteOutline:
    "M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19M8,9H16V19H8V9M15.5,4L14.5,3H9.5L8.5,4H5V6H19V4H15.5Z",
};

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

// Shared loading-spinner/error styles for both the trigger dialog and the
// Popup Manager panel. Deliberately a hand-rolled CSS spinner rather than an
// HA internal component (e.g. ha-circular-progress) — this has zero
// dependency on undocumented internals, themes correctly via
// var(--primary-color), and is guaranteed to render the same everywhere.
(function injectSharedStyles() {
  if (document.getElementById("nativepop-shared-styles")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "nativepop-shared-styles";
  style.textContent = `
    .nativepop-loading, .nativepop-error {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 16px; padding: 48px 24px; min-height: 200px;
      color: var(--secondary-text-color); text-align: center;
    }
    .nativepop-error ha-icon { color: var(--error-color, #db4437); --mdc-icon-size: 32px; }
    .nativepop-spinner {
      width: 32px; height: 32px; border-radius: 50%;
      border: 3px solid var(--divider-color);
      border-top-color: var(--primary-color);
      animation: nativepop-spin 0.8s linear infinite;
    }
    @keyframes nativepop-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
})();

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

  // Open the dialog shell immediately with a loading state, rather than
  // waiting on the WS fetch below first — otherwise there's a silent delay
  // between tapping/navigating and anything appearing at all.
  const dialog = document.createElement("ha-dialog");
  dialog.heading = "NativePop";
  dialog.open = true;
  // mwc-dialog's default width is cramped for a full dashboard view; widen
  // it via the custom property ha-dialog actually reads for its default
  // ("medium") width tier (see src/components/ha-dialog.ts).
  dialog.style.setProperty("--ha-dialog-width-md", "min(90vw, 1024px)");

  const content = document.createElement("div");
  content.className = "nativepop-loading";
  content.innerHTML = `<div class="nativepop-spinner"></div><span>Loading popup…</span>`;
  dialog.appendChild(content);

  currentDialog = dialog;
  currentPopupUrlPath = popupUrlPath;
  dialogOpenedViaHash = viaHash;
  dialogPushedByUs = pushedByUs;

  // ha-dialog (mwc-dialog) fires "closed" on any close path (X, ESC, outside
  // click — which is already the default here since we never set
  // preventScrimClose — or us setting .open = false).
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
    if (currentDialog === dialog) {
      content.className = "nativepop-error";
      content.innerHTML = `<ha-icon icon="mdi:alert-circle-outline"></ha-icon><span>Could not load popup "${popupUrlPath}". See console for details.</span>`;
    }
    return;
  }

  if (currentDialog !== dialog) {
    // Closed again before the fetch resolved (e.g. tapped open then
    // immediately closed) - nothing left to mount into.
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

  const view = document.createElement("hui-view");
  view.hass = hass;
  view.lovelace = lovelace;
  view.index = 0; // popup dashboards are single-view (spec 5.1)
  view.narrow = false;

  content.remove();
  dialog.appendChild(view);
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

// Real dialog for entering a popup's name (create/rename), matching HA's own
// dashboard create/edit dialog (dialog-lovelace-dashboard-detail.ts) instead
// of a browser prompt(): ha-dialog + ha-form (schema-driven, so it renders
// through the same field components any native settings form uses) +
// ha-dialog-footer with primary/secondary ha-button actions. Resolves to the
// trimmed title string, or null if cancelled.
function showNativePopFormDialog(hass, { heading, initialTitle = "", confirmLabel }) {
  return new Promise((resolve) => {
    let currentTitle = initialTitle;
    let resolved = false;

    const dialog = document.createElement("ha-dialog");
    dialog.heading = heading;
    dialog.open = true;

    const form = document.createElement("ha-form");
    form.hass = hass;
    form.schema = [{ name: "title", required: true, selector: { text: {} } }];
    form.data = { title: currentTitle };
    form.computeLabel = (schema) => (schema.name === "title" ? "Name" : schema.name);

    const cancelBtn = document.createElement("ha-button");
    cancelBtn.slot = "secondaryAction";
    cancelBtn.setAttribute("appearance", "plain");
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      dialog.open = false;
    });

    // Bare <ha-button slot="primaryAction"> with no variant/appearance
    // override, matching the native dialog's primary action exactly.
    const primaryBtn = document.createElement("ha-button");
    primaryBtn.slot = "primaryAction";
    primaryBtn.textContent = confirmLabel;
    primaryBtn.disabled = !currentTitle.trim();
    primaryBtn.addEventListener("click", () => {
      resolved = true;
      dialog.open = false;
      resolve(currentTitle.trim());
    });

    form.addEventListener("value-changed", (ev) => {
      currentTitle = ev.detail.value.title || "";
      form.data = ev.detail.value;
      primaryBtn.disabled = !currentTitle.trim();
    });

    const footer = document.createElement("ha-dialog-footer");
    footer.slot = "footer";
    footer.appendChild(cancelBtn);
    footer.appendChild(primaryBtn);

    dialog.appendChild(form);
    dialog.appendChild(footer);

    dialog.addEventListener("closed", () => {
      dialog.remove();
      if (!resolved) {
        resolve(null);
      }
    });

    document.body.appendChild(dialog);
  });
}

// Sidebar panel: list / create / rename / delete popups. Registered as
// <nativepop-panel> by the integration's frontend.py (no manual YAML). HA
// sets `.hass` (repeatedly, on every state change), `.narrow`, and `.panel`
// (the panel_custom config) on this element.
//
// The list is a real <ha-data-table> (see file header for why this needed a
// build step) - the same component Settings > Dashboards uses
// (ha-config-lovelace-dashboards.ts), which gets us sortable columns,
// clickable rows, an overflow menu per row, AND a built-in search box for
// free (search box appears automatically once any column is `filterable`).
//
// The "+ New popup" button is a plain positioned <ha-button size="l">, not a
// real FAB - HA itself removed the ha-fab component as of 2026.5 ("we use
// just a normal ha-button now, since the position styling was always done
// from the parent component"). The native page's FAB lives inside a
// hass-tabs-subpage's `slot="fab"`, which only works within that specific
// (much bigger) component; we replicate the visual with our own CSS instead.
//
// Create/rename use a real dialog (showNativePopFormDialog, above) built
// from the same pieces HA's own dashboard create/edit dialog uses
// (dialog-lovelace-dashboard-detail.ts): ha-dialog + ha-form + ha-dialog-footer
// with primary/secondary ha-button. Delete stays a plain confirm() - a
// destructive-action confirmation, not really part of "the list interface."
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

  set narrow(narrow) {
    this._narrow = narrow;
  }

  _columns() {
    return {
      icon: {
        title: "",
        label: "",
        type: "icon",
        minWidth: "56px",
        maxWidth: "56px",
        template: () => html`<ha-icon icon="mdi:window-restore"></ha-icon>`,
      },
      title: {
        title: "Name",
        main: true,
        sortable: true,
        filterable: true,
        flex: 2,
        // Inline styles, not a class from this element's own <style> tag:
        // ha-data-table renders these templates inside its own shadow root,
        // which class-based selectors from our light-DOM stylesheet can't
        // reach (CSS custom properties do cross that boundary, class
        // selectors don't).
        template: (popup) => html`
          <div>${popup.title}</div>
          <div
            style="color: var(--secondary-text-color); font-size: 12px; cursor: pointer; width: fit-content;"
            title="Click to copy"
            @click=${(ev) => {
              // Row is clickable (opens edit mode) - stop this from also
              // triggering that, since copying and editing are different intents.
              ev.stopPropagation();
              this._copyToClipboard(`#${popup.url_path}`);
            }}
          >
            #${popup.url_path}
          </div>
        `,
      },
      url_path: {
        title: "URL path",
        hidden: true,
        filterable: true,
      },
      actions: {
        title: "",
        type: "overflow-menu",
        showNarrow: true,
        template: (popup) => html`
          <ha-icon-overflow-menu
            .hass=${this._hass}
            narrow
            .items=${[
              {
                path: ICON_PATHS.renameBox,
                label: "Rename",
                action: () => this._renamePopup(popup),
              },
              {
                path: ICON_PATHS.pencil,
                label: "Edit",
                action: () => this._editPopup(popup),
              },
              {
                path: ICON_PATHS.deleteOutline,
                label: "Delete",
                action: () => this._deletePopup(popup),
                warning: true,
              },
            ]}
          ></ha-icon-overflow-menu>
        `,
      },
    };
  }

  _init() {
    this.innerHTML = `
      <style>
        :host { display: block; height: 100%; box-sizing: border-box; overflow: auto; background: var(--primary-background-color); }
        .toolbar {
          display: flex; align-items: center; gap: 16px; height: 56px; padding: 0 16px;
          box-sizing: border-box;
          background: var(--app-header-background-color, var(--primary-background-color));
          color: var(--app-header-text-color, var(--primary-text-color));
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
          position: sticky; top: 0; z-index: 1;
        }
        .toolbar .title { font-size: 20px; font-weight: 400; flex: 1; }
        .content { padding-bottom: 88px; max-width: 900px; margin: 0 auto; }
        .fab-button {
          position: fixed; bottom: 16px; right: 16px; z-index: 2;
        }
      </style>
      <div class="toolbar">
        <ha-icon-button class="menu-btn" label="Menu"><ha-icon icon="mdi:menu"></ha-icon></ha-icon-button>
        <span class="title">Popup Manager</span>
      </div>
      <div class="content">
        <div class="nativepop-loading" id="loading"><div class="nativepop-spinner"></div></div>
        <ha-data-table id="table" hidden clickable auto-height></ha-data-table>
      </div>
      <ha-button size="l" class="fab-button" id="create-btn">
        <ha-icon slot="start" icon="mdi:plus"></ha-icon>
        New popup
      </ha-button>
    `;

    const menuBtn = this.querySelector(".menu-btn");
    if (this._narrow) {
      // Same event ha-menu-button itself dispatches on click (toggles the
      // real sidebar) - see src/components/ha-menu-button.ts. We dispatch it
      // directly instead of using <ha-menu-button> itself, since that reads
      // Lit context that may not reach a panel_custom element reliably.
      menuBtn.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
      });
    } else {
      menuBtn.style.display = "none";
    }

    this._table = this.querySelector("#table");
    this._table.columns = this._columns();
    this._table.searchLabel = "Search popups";
    this._table.noDataText = "No popups yet — create one to get started.";
    this._table.addEventListener("row-click", (ev) => {
      const popup = (this._popups || []).find((p) => p.id === ev.detail.id);
      if (popup) {
        this._editPopup(popup);
      }
    });

    this.querySelector("#create-btn").addEventListener("click", () => this._createPopup());

    this._refresh();
  }

  async _refresh() {
    const loadingEl = this.querySelector("#loading");

    loadingEl.hidden = false;
    this._table.hidden = true;

    let dashboards;
    try {
      dashboards = await this._hass.callWS({ type: "lovelace/dashboards/list" });
    } catch (err) {
      console.error("NativePop: could not list dashboards", err);
      loadingEl.hidden = true;
      this._table.hidden = false;
      this._table.noDataText = "Could not load popups. See console for details.";
      this._popups = [];
      this._table.data = [];
      return;
    }

    this._popups = dashboards
      .filter((d) => d.url_path && d.url_path.startsWith(POPUP_URL_PATH_PREFIX))
      .sort((a, b) => a.title.localeCompare(b.title));

    loadingEl.hidden = true;
    this._table.hidden = false;
    this._table.hass = this._hass;
    this._table.data = this._popups;
  }

  _showToast(message) {
    // Same event src/util/toast.ts's showToast() fires - a NotificationManager
    // mounted at the app root listens for it and renders HA's real toast UI.
    this.dispatchEvent(
      new CustomEvent("hass-notification", { detail: { message }, bubbles: true, composed: true })
    );
  }

  async _copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // navigator.clipboard needs a secure context (HTTPS/localhost) - a
        // plain-HTTP local HA instance won't have it. Fall back to the
        // older (deprecated but still universally supported) technique.
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      this._showToast(`Copied "${text}" to clipboard`);
    } catch (err) {
      console.error("NativePop: could not copy to clipboard", err);
      alert("NativePop: could not copy to clipboard. See console for details.");
    }
  }

  // Opens the dashboard's native editor directly (spec 5.2) via HA's own
  // "?edit=1" query param convention (src/panels/lovelace/hui-root.ts).
  _editPopup(popup) {
    history.pushState(null, "", `/${popup.url_path}?edit=1`);
    fireLocationChanged();
  }

  async _renamePopup(popup) {
    const newTitle = await showNativePopFormDialog(this._hass, {
      heading: "Rename popup",
      initialTitle: popup.title,
      confirmLabel: "Rename",
    });
    if (!newTitle || newTitle === popup.title) {
      return;
    }
    try {
      // Title only — url_path stays fixed, since triggers (hash,
      // fire-dom-event, automations) are wired to it (see file header).
      await this._hass.callWS({
        type: "lovelace/dashboards/update",
        dashboard_id: popup.id,
        title: newTitle,
      });
    } catch (err) {
      console.error("NativePop: could not rename popup dashboard", err);
      alert("NativePop: could not rename popup. See console for details.");
      return;
    }
    await this._refresh();
  }

  async _createPopup() {
    const title = await showNativePopFormDialog(this._hass, {
      heading: "Create popup",
      confirmLabel: "Create",
    });
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
  description: "Proof-of-concept test harness trigger for NativePop popups.",
});

console.info("NativePop: milestone 5 loaded (panel now uses ha-data-table: sortable columns, search, overflow menu)");

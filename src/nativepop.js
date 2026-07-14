// NativePop frontend module.
//
// Auto-loaded on every Home Assistant frontend page by the companion
// integration (custom_components/nativepop/) via add_extra_js_url(), so the
// trigger listeners below are always live. Also registers the "Popup
// Manager" sidebar panel (self-registered by the integration via
// panel_custom.async_register_panel() - no manual configuration.yaml entry
// needed).
//
// Three ways to trigger a popup, all funneling into the same dialog mount
// (openNativePopDialog):
//
// 1. Navigate to a "#popup-<slug>" hash - the recommended tap trigger, fully
//    visual-editor friendly:
//      tap_action: { action: navigate, navigation_path: "#popup-<slug>" }
//    `navigate` internally uses history.pushState(), which never fires
//    `hashchange`/`popstate` on its own (standard browser behavior) - HA
//    fires its own `location-changed` event after every navigate() call
//    (see src/common/navigate.ts), which is why that's included below
//    alongside hashchange/popstate.
//
// 2. `fire-dom-event`, a YAML-only fallback (HA's visual action picker
//    doesn't expose this action, though it still works):
//      tap_action: { action: fire-dom-event, nativepop_popup: "popup-<slug>" }
//    HA's `fire-dom-event` action dispatches a
//    `CustomEvent("ll-custom", { bubbles: true, composed: true, detail: <actionConfig> })`
//    on the card element (see src/panels/lovelace/common/handle-action.ts) -
//    any card using HA's shared action handler gets this for free. A
//    handful of custom cards hand-roll their own click handling and won't
//    fire it.
//
// 3. An automation's built-in "Fire an event" action, no tap involved at all:
//      actions:
//        - event: nativepop_open_popup
//          event_data:
//            popup: popup-<slug>
//    We subscribe to that event type over the same websocket connection
//    `hass` already uses. This broadcasts to every connected frontend
//    session - there's no per-browser/per-user targeting.
//
// Popups are naming-convention based: any dashboard whose url_path starts
// with "popup-" counts, no metadata registry.
//
// The Popup Manager panel's list is a real `ha-data-table` (the same
// component Settings > Dashboards uses), which needs `lit-html`'s `html`
// tag for its column templates - a plain HTML string gets auto-escaped as
// literal text by Lit's XSS protection, not parsed as markup. That's the
// one place this project needs a build step (esbuild, see package.json);
// everything else here is plain, dependency-free JS.
import { html } from "lit-html";

const POPUP_URL_PATH_PREFIX = "popup-";
const POPUP_HASH_PREFIX = `#${POPUP_URL_PATH_PREFIX}`;
const DEFAULT_POPUP_URL_PATH = "popup-test"; // fallback for the trigger example card only

// Real MDI SVG path data (from @mdi/js / @mdi/svg), needed because
// ha-icon-overflow-menu's `items[].path` field requires raw path data, not
// an "mdi:name" string the way ha-icon-button's slot fallback accepts.
const ICON_PATHS = {
  pencil:
    "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z",
  cog:
    "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z",
  deleteOutline:
    "M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19M8,9H16V19H8V9M15.5,4L14.5,3H9.5L8.5,4H5V6H19V4H15.5Z",
};

// Applies a block of "--custom-property: value;" lines (one per line, or
// semicolon-separated) to an element's inline style - the free-text "custom
// CSS variables" popup setting. Deliberately narrow: only ever calls
// style.setProperty() with a parsed --name/value pair, so there's no way
// for this to inject arbitrary CSS rules or run anything - at worst, an
// unmatched/garbage line is silently ignored.
function applyCustomCssVariables(el, cssVariablesText) {
  if (!cssVariablesText) {
    return;
  }
  for (const line of cssVariablesText.split(/[\n;]/)) {
    const match = line.match(/^\s*(--[a-zA-Z0-9-]+)\s*:\s*(.+?)\s*$/);
    if (match) {
      el.style.setProperty(match[1], match[2]);
    }
  }
}

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

// Same root element, same trick: HA computes "narrow" (mobile/small-viewport)
// once at the app root and passes it down to every panel (panel_custom's
// own `.narrow` setter - see NativePopPanel below - gets it this same way).
// Reading it here too means the popup dialog's width override can defer to
// HA's own narrow/mobile detection instead of us guessing a breakpoint.
function isNarrow() {
  const haEl = document.querySelector("home-assistant");
  return !!(haEl && haEl.narrow);
}

// A user-entered dialog width (free text: "800px", "70%", etc.) is only
// ever trusted if it parses as a plain CSS length/percentage - anything
// else (empty, garbage) means "use the default," not "break the dialog."
function sanitizeDialogWidth(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return /^\d+(\.\d+)?(px|%|vw|rem|em)$/.test(trimmed) ? trimmed : null;
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
  //
  // ha-adaptive-dialog renders as a real ha-dialog on desktop (wider than
  // ~870px and taller than ~500px) and a real swipeable ha-bottom-sheet
  // below that. `allowModeChange` handles rotating a tablet/phone while a
  // popup is open. In desktop mode it composes an actual nested <ha-dialog>
  // internally and forwards `.width`, so the --ha-dialog-width-md override
  // below still applies normally.
  const dialog = document.createElement("ha-adaptive-dialog");
  // No default title/subtitle - blank unless a popup's own settings set
  // one, applied once the config fetch below resolves.
  dialog.width = "medium";
  dialog.allowModeChange = true;
  dialog.open = true;
  // mwc-dialog's default width is cramped for a full dashboard view; widen
  // it via the custom property ha-dialog reads for its "medium" width tier.
  // A per-popup custom width can override this once the config fetch below
  // resolves, but only on desktop - on narrow/bottom-sheet mode this is
  // left untouched so mobile always gets the full-width sheet.
  if (!isNarrow()) {
    dialog.style.setProperty("--ha-dialog-width-md", "min(90vw, 1024px)");
  }

  const content = document.createElement("div");
  content.className = "nativepop-loading";
  content.innerHTML = `<div class="nativepop-spinner"></div><span>Loading popup…</span>`;
  dialog.appendChild(content);

  currentDialog = dialog;
  currentPopupUrlPath = popupUrlPath;
  dialogOpenedViaHash = viaHash;
  dialogPushedByUs = pushedByUs;

  // ha-adaptive-dialog fires "closed" on any close path (X, ESC, outside
  // click - already the default since we never set preventScrimClose -
  // swipe-down on mobile, or us setting .open = false).
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

  const popupView = (lovelaceConfig.views && lovelaceConfig.views[0]) || {};

  if (!isNarrow()) {
    const customWidth = sanitizeDialogWidth(popupView.nativepop_dialog_width);
    if (customWidth) {
      dialog.style.setProperty("--ha-dialog-width-md", customWidth);
    }
  }

  // Header/subtitle and any free-form CSS variable overrides (popup
  // settings, see NativePopPanel._openPopupSettings) - unlike width, these
  // apply regardless of narrow/desktop.
  if (popupView.nativepop_header) {
    dialog.headerTitle = popupView.nativepop_header;
  }
  if (popupView.nativepop_subheader) {
    dialog.headerSubtitle = popupView.nativepop_subheader;
  }
  applyCustomCssVariables(dialog, popupView.nativepop_css_variables);

  // Minimal but structurally correct `Lovelace` object — matches the shape
  // hui-view/hui-root expect (config, rawConfig, editMode, urlPath, mode,
  // locale, plus the edit/save/toast callbacks). The popup is read-only, so
  // the mutating callbacks are no-ops.
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
  // hui-sections-view's own ":host" rule defines its nested ".wrapper" div's
  // horizontal padding from --ha-view-sections-column-gap/
  // --ha-view-sections-narrow-column-gap (32px/8px by default). hui-view has
  // no shadow root of its own and hui-sections-view is its direct light-DOM
  // child, so setting these on `view` - created synchronously, before it's
  // ever rendered - reaches it with no shadow boundary and no flash of the
  // padded state first.
  view.style.setProperty("--ha-view-sections-column-gap", "0");
  view.style.setProperty("--ha-view-sections-narrow-column-gap", "0");
  // Applied to both `dialog` (chrome-level variables like border-radius,
  // header font size) and `view` (content-level variables like the two
  // above) so a custom override reaches whichever element actually reads it.
  applyCustomCssVariables(view, popupView.nativepop_css_variables);

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

// Create only ever asks for a name (used to generate the slug/url_path) -
// everything else is a popup *settings* concern (below), not a creation-time
// decision.
const POPUP_CREATE_SCHEMA = [{ name: "title", required: true, selector: { text: {} } }];

// Popup settings: rename + how the popup's own dialog looks when it opens.
// Free text throughout rather than dropdowns/presets, so arbitrary values
// are always possible (e.g. any px/% width, not a fixed set of sizes).
// sanitizeDialogWidth() and applyCustomCssVariables() validate/parse width
// and CSS respectively - this form doesn't hard-gate on either being
// well-formed.
const POPUP_SETTINGS_SCHEMA = [
  { name: "title", required: true, selector: { text: {} } },
  { name: "header", required: false, selector: { text: {} } },
  { name: "subheader", required: false, selector: { text: {} } },
  { name: "width", required: false, selector: { text: {} } },
  { name: "css_variables", required: false, selector: { text: { multiline: true } } },
];

function computePopupFormLabel(schema) {
  switch (schema.name) {
    case "title":
      return "Name";
    case "header":
      return "Popup header";
    case "subheader":
      return "Popup subheader";
    case "width":
      return "Dialog width (desktop only)";
    case "css_variables":
      return "Custom CSS variables (advanced)";
    default:
      return schema.name;
  }
}

function computePopupFormHelper(schema) {
  switch (schema.name) {
    case "header":
      return "Shown at the top of the popup dialog when it opens. Leave blank for no title.";
    case "subheader":
      return "Optional smaller text under the header.";
    case "width":
      return 'e.g. "800px" or "70%" - leave blank for the default. Narrow/mobile screens always open as a full-width swipeable sheet instead, regardless of this setting.';
    case "css_variables":
      return 'One "--variable: value;" per line, applied directly to this popup\'s dialog. See the README\'s "Popup dialog CSS variables" section for the list of variables you can use here. Leave blank for defaults.';
    default:
      return "";
  }
}

// Real dialog for entering a popup's name (create) or full settings
// (rename/settings), matching HA's own dashboard create/edit dialog
// (dialog-lovelace-dashboard-detail.ts) instead of a browser prompt():
// ha-adaptive-dialog (see openNativePopDialog for why - real desktop
// dialog/mobile bottom-sheet, with genuine swipe-to-close, not just a
// resized ha-dialog) + ha-form (schema-driven, so it renders through the
// same field components any native settings form uses) + ha-dialog-footer
// with primary/secondary ha-button actions. Resolves to the data object
// (raw/untrimmed - callers sanitize each field as needed), or null if
// cancelled.
function showNativePopFormDialog(hass, { heading, data, schema, confirmLabel }) {
  return new Promise((resolve) => {
    let currentData = { ...data };
    let resolved = false;

    const dialog = document.createElement("ha-adaptive-dialog");
    dialog.headerTitle = heading;
    dialog.width = "small";
    dialog.allowModeChange = true;
    dialog.open = true;

    const form = document.createElement("ha-form");
    form.hass = hass;
    form.schema = schema;
    form.data = currentData;
    form.computeLabel = computePopupFormLabel;
    form.computeHelper = computePopupFormHelper;

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
    primaryBtn.disabled = !currentData.title.trim();
    primaryBtn.addEventListener("click", () => {
      resolved = true;
      dialog.open = false;
      resolve(currentData);
    });

    form.addEventListener("value-changed", (ev) => {
      currentData = ev.detail.value;
      form.data = currentData;
      primaryBtn.disabled = !(currentData.title || "").trim();
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
// clickable rows, AND a built-in search box for free (search box appears
// automatically once any column is `filterable`). Row actions are three
// plain ha-icon-buttons, all visible on the row at once, rather than the
// native page's overflow ("⋮") menu.
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
        // Three icon buttons at their default ~48px touch target already
        // sum to 144px with zero room left for the cell's own padding - a
        // maxWidth pinned to exactly that clips/pushes them out. Give it
        // headroom instead of an exact-fit cap.
        minWidth: "168px",
        showNarrow: true,
        // Three plain ha-icon-buttons, all visible on the row at once,
        // instead of an overflow menu. Uses .path= directly (real SVG data,
        // see ICON_PATHS) now that real Lit templates are available, rather
        // than the slotted-<ha-icon> fallback used before the build step
        // existed. "Settings" (cog icon) covers rename + how the popup's
        // dialog looks when it opens.
        template: (popup) => html`
          <div style="display: flex; width: 100%; justify-content: flex-end;">
            <ha-icon-button
              .path=${ICON_PATHS.cog}
              label="Settings"
              @click=${(ev) => {
                ev.stopPropagation();
                this._openPopupSettings(popup);
              }}
            ></ha-icon-button>
            <ha-icon-button
              .path=${ICON_PATHS.pencil}
              label="Edit"
              @click=${(ev) => {
                ev.stopPropagation();
                this._editPopup(popup);
              }}
            ></ha-icon-button>
            <ha-icon-button
              .path=${ICON_PATHS.deleteOutline}
              label="Delete"
              @click=${(ev) => {
                ev.stopPropagation();
                this._deletePopup(popup);
              }}
            ></ha-icon-button>
          </div>
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
        .content { padding-bottom: 88px; }
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

  // Rename + how the popup's own dialog looks when it opens (header,
  // subheader, width, raw CSS variables) - one settings dialog rather than
  // a plain rename, since all of these are "how this popup presents itself"
  // decisions that belong together, not creation-time decisions (5.2).
  async _openPopupSettings(popup) {
    // Fetched once up front: pre-fills the dialog, and (if anything besides
    // the name changes) gets reused to save it back - a single
    // lovelace/config round trip either way instead of several.
    let config;
    try {
      config = await this._hass.callWS({ type: "lovelace/config", url_path: popup.url_path });
    } catch (err) {
      console.error("NativePop: could not load popup config for settings", err);
      alert("NativePop: could not load popup. See console for details.");
      return;
    }
    const view = (config.views && config.views[0]) || {};
    const current = {
      header: view.nativepop_header || "",
      subheader: view.nativepop_subheader || "",
      width: view.nativepop_dialog_width || "",
      cssVariables: view.nativepop_css_variables || "",
    };

    const result = await showNativePopFormDialog(this._hass, {
      heading: "Popup settings",
      data: {
        title: popup.title,
        header: current.header,
        subheader: current.subheader,
        width: current.width,
        css_variables: current.cssVariables,
      },
      schema: POPUP_SETTINGS_SCHEMA,
      confirmLabel: "Save",
    });
    if (!result) {
      return;
    }

    const newTitle = (result.title || "").trim();
    const newHeader = (result.header || "").trim();
    const newSubheader = (result.subheader || "").trim();
    const newWidth = sanitizeDialogWidth(result.width) || "";
    const newCssVariables = (result.css_variables || "").trim();

    const titleChanged = newTitle && newTitle !== popup.title;
    const viewSettingsChanged =
      newHeader !== current.header ||
      newSubheader !== current.subheader ||
      newWidth !== current.width ||
      newCssVariables !== current.cssVariables;

    if (!titleChanged && !viewSettingsChanged) {
      return;
    }

    if (titleChanged) {
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
    }

    if (viewSettingsChanged) {
      const views = config.views ? [...config.views] : [{ type: "sections", sections: [] }];
      const newView = { ...views[0] };
      const setOrDelete = (key, value) => {
        if (value) {
          newView[key] = value;
        } else {
          delete newView[key];
        }
      };
      setOrDelete("nativepop_header", newHeader);
      setOrDelete("nativepop_subheader", newSubheader);
      setOrDelete("nativepop_dialog_width", newWidth);
      setOrDelete("nativepop_css_variables", newCssVariables);
      views[0] = newView;
      try {
        await this._hass.callWS({
          type: "lovelace/config/save",
          url_path: popup.url_path,
          config: { ...config, views },
        });
      } catch (err) {
        console.error("NativePop: could not save popup settings", err);
        alert("NativePop: could not save popup settings. See console for details.");
      }
    }

    await this._refresh();
  }

  async _createPopup() {
    // Create only asks for a name - everything else (header/subheader/
    // width/CSS) is a popup settings concern, set afterward via the "⚙"
    // action once the popup exists (see _openPopupSettings).
    const result = await showNativePopFormDialog(this._hass, {
      heading: "Create popup",
      data: { title: "" },
      schema: POPUP_CREATE_SCHEMA,
      confirmLabel: "Create",
    });
    if (!result) {
      return;
    }
    const title = (result.title || "").trim();
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

// Example card: a configurable `popup:` slug with one button per tap
// trigger path, each going through the same generic mechanism any card's
// tap_action would use (dispatching ll-custom / setting location.hash)
// rather than calling the internal functions directly. Handy for quickly
// testing a popup without wiring up tap_action YAML on an existing card.
class NativePopTriggerExampleCard extends HTMLElement {
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
      <ha-card header="NativePop Trigger Example">
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

customElements.define("nativepop-trigger-example", NativePopTriggerExampleCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "nativepop-trigger-example",
  name: "NativePop Trigger Example",
  description: "Example card demonstrating NativePop's direct and hash-navigation triggers.",
});

console.info("NativePop loaded");

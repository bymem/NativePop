// NativePop — Milestone 1 + 2 proof of concept
//
// Milestone 1: hardcoded direct-trigger card that fetches one manually-created
// hidden dashboard's config and mounts it via HA's internal `hui-view` inside
// a dialog.
// Milestone 2: adds a global hashchange/popstate listener so the same dialog
// mount can also be opened by navigating to "#popup-test" (deep link,
// back-button aware), matching Bubble Card's `hash:` trigger style.
//
// Both still target the ONE hardcoded dashboard below. Milestone 3
// generalizes this into a reusable, slug-driven trigger element.

const POPUP_URL_PATH = "popup-test";
const POPUP_HASH = `#${POPUP_URL_PATH}`;

let currentDialog = null;
let dialogOpenedViaHash = false;
let dialogPushedByUs = false;
let weSetHashOurselves = false;

// The trigger card only has a `hass` while it's connected to a dashboard.
// The hash listener has to work even when no NativePop card is on screen
// (a true deep link), so it reads `hass` straight off HA's root element
// instead — a well-known but undocumented escape hatch, same category of
// internal dependency as `hui-view` itself (see spec section 7).
function getHass() {
  const haEl = document.querySelector("home-assistant");
  return haEl ? haEl.hass : undefined;
}

async function openNativePopDialog(hass, { viaHash = false, pushedByUs = false } = {}) {
  if (currentDialog) {
    return; // already open, don't double-mount
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
      url_path: POPUP_URL_PATH,
    });
  } catch (err) {
    console.error(
      `NativePop: could not fetch dashboard config for "${POPUP_URL_PATH}"`,
      err
    );
    alert(
      `NativePop: could not load popup dashboard "${POPUP_URL_PATH}". See console for details.`
    );
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
    urlPath: POPUP_URL_PATH,
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
  dialogOpenedViaHash = viaHash;
  dialogPushedByUs = pushedByUs;

  // ha-dialog (mwc-dialog) fires "closed" on any close path (X, ESC, outside
  // click, or us setting .open = false).
  dialog.addEventListener("closed", () => {
    dialog.remove();
    currentDialog = null;

    const wasViaHash = dialogOpenedViaHash;
    const wasPushedByUs = dialogPushedByUs;
    dialogOpenedViaHash = false;
    dialogPushedByUs = false;

    if (!wasViaHash || location.hash !== POPUP_HASH) {
      // Direct trigger, or the hash already changed (e.g. the user hit
      // back, which is what closed us in the first place) - nothing to revert.
      return;
    }

    if (wasPushedByUs) {
      // We added this hash to the history stack ourselves (nav-trigger
      // button) -> closing the dialog should behave like pressing back.
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

function handleHashChange() {
  if (location.hash === POPUP_HASH) {
    if (!currentDialog) {
      const pushedByUs = weSetHashOurselves;
      weSetHashOurselves = false;
      openNativePopDialog(getHass(), { viaHash: true, pushedByUs });
    }
  } else if (currentDialog && dialogOpenedViaHash) {
    closeNativePopDialog();
  }
}

window.addEventListener("hashchange", handleHashChange);
window.addEventListener("popstate", handleHashChange);

// Handle a cold load where the URL already has "#popup-test" in it (a real
// deep link opened fresh). `hass` might not exist on the root element yet at
// this point, so retry briefly instead of giving up immediately.
(function openFromInitialHash() {
  if (location.hash !== POPUP_HASH) {
    return;
  }
  let attempts = 0;
  const tick = () => {
    const hass = getHass();
    if (hass) {
      openNativePopDialog(hass, { viaHash: true, pushedByUs: false });
      return;
    }
    attempts += 1;
    if (attempts < 20) {
      setTimeout(tick, 250);
    } else {
      console.warn(
        "NativePop: gave up waiting for hass to open popup from initial hash"
      );
    }
  };
  tick();
})();

// Bare-bones trigger card: one button per trigger path. Milestone 3
// generalizes both into a reusable, slug-driven trigger mechanism.
class NativePopPocCard extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
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
      openNativePopDialog(this._hass, { viaHash: false });
    });

    this.querySelector("#hash-btn").addEventListener("click", () => {
      weSetHashOurselves = true;
      location.hash = POPUP_URL_PATH; // handleHashChange() does the actual opening
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
  description: "Milestone 1+2 proof of concept trigger for NativePop popups.",
});

console.info("NativePop: milestone 2 PoC card loaded");

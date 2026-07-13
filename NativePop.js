// NativePop — Milestone 1 proof of concept
//
// Goal (per spec, milestone 1): validate that we can fetch a hidden popup
// dashboard's config and mount it inside a dialog using HA's own `hui-view`
// element, triggered by a direct tap. Everything here is intentionally
// hardcoded/throwaway — no slug-driven trigger element, no navigation/hash
// support, no sidebar panel yet. Those come in later milestones.
//
// Setup:
// 1. In HA, manually create a dashboard: Settings > Dashboards > Add dashboard,
//    uncheck "Show in sidebar", give it a URL path (e.g. "popup-test"),
//    add some cards to its single view.
// 2. Change POPUP_URL_PATH below to match that url_path.
// 3. Add a card to any dashboard with: type: custom:nativepop-poc-card
// 4. Tap the card's button — it should open the popup dashboard's view in a dialog.

const POPUP_URL_PATH = "popup-test";

async function openNativePopDialog(hass) {
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

  // ha-dialog (mwc-dialog) fires "closed" on any close path (X, ESC, etc.)
  dialog.addEventListener("closed", () => {
    dialog.remove();
  });

  document.body.appendChild(dialog);
}

// Bare-bones direct-trigger card: a button that opens the hardcoded popup.
// Milestone 3 generalizes this into a reusable, slug-driven trigger.
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
        <div style="padding: 16px;">
          <mwc-button raised>Open popup</mwc-button>
        </div>
      </ha-card>
    `;

    this.querySelector("mwc-button").addEventListener("click", () => {
      openNativePopDialog(this._hass);
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
  description: "Milestone 1 proof of concept trigger for NativePop popups.",
});

console.info("NativePop: milestone 1 PoC card loaded");

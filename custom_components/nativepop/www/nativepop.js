// node_modules/lit-html/lit-html.js
var t = globalThis;
var i = (t2) => t2;
var s = t.trustedTypes;
var e = s ? s.createPolicy("lit-html", { createHTML: (t2) => t2 }) : void 0;
var h = "$lit$";
var o = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n = "?" + o;
var r = `<${n}>`;
var l = document;
var c = () => l.createComment("");
var a = (t2) => null === t2 || "object" != typeof t2 && "function" != typeof t2;
var u = Array.isArray;
var d = (t2) => u(t2) || "function" == typeof t2?.[Symbol.iterator];
var f = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m = />/g;
var p = RegExp(`>|${f}(?:([^\\s"'>=/]+)(${f}*=${f}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var g = /'/g;
var $ = /"/g;
var y = /^(?:script|style|textarea|title)$/i;
var x = (t2) => (i2, ...s2) => ({ _$litType$: t2, strings: i2, values: s2 });
var b = x(1);
var w = x(2);
var T = x(3);
var E = /* @__PURE__ */ Symbol.for("lit-noChange");
var A = /* @__PURE__ */ Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l.createTreeWalker(l, 129);
function V(t2, i2) {
  if (!u(t2) || !t2.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e ? e.createHTML(i2) : i2;
}
var N = (t2, i2) => {
  const s2 = t2.length - 1, e2 = [];
  let n2, l2 = 2 === i2 ? "<svg>" : 3 === i2 ? "<math>" : "", c2 = v;
  for (let i3 = 0; i3 < s2; i3++) {
    const s3 = t2[i3];
    let a2, u2, d2 = -1, f2 = 0;
    for (; f2 < s3.length && (c2.lastIndex = f2, u2 = c2.exec(s3), null !== u2); ) f2 = c2.lastIndex, c2 === v ? "!--" === u2[1] ? c2 = _ : void 0 !== u2[1] ? c2 = m : void 0 !== u2[2] ? (y.test(u2[2]) && (n2 = RegExp("</" + u2[2], "g")), c2 = p) : void 0 !== u2[3] && (c2 = p) : c2 === p ? ">" === u2[0] ? (c2 = n2 ?? v, d2 = -1) : void 0 === u2[1] ? d2 = -2 : (d2 = c2.lastIndex - u2[2].length, a2 = u2[1], c2 = void 0 === u2[3] ? p : '"' === u2[3] ? $ : g) : c2 === $ || c2 === g ? c2 = p : c2 === _ || c2 === m ? c2 = v : (c2 = p, n2 = void 0);
    const x2 = c2 === p && t2[i3 + 1].startsWith("/>") ? " " : "";
    l2 += c2 === v ? s3 + r : d2 >= 0 ? (e2.push(a2), s3.slice(0, d2) + h + s3.slice(d2) + o + x2) : s3 + o + (-2 === d2 ? i3 : x2);
  }
  return [V(t2, l2 + (t2[s2] || "<?>") + (2 === i2 ? "</svg>" : 3 === i2 ? "</math>" : "")), e2];
};
var S = class _S {
  constructor({ strings: t2, _$litType$: i2 }, e2) {
    let r2;
    this.parts = [];
    let l2 = 0, a2 = 0;
    const u2 = t2.length - 1, d2 = this.parts, [f2, v2] = N(t2, i2);
    if (this.el = _S.createElement(f2, e2), P.currentNode = this.el.content, 2 === i2 || 3 === i2) {
      const t3 = this.el.content.firstChild;
      t3.replaceWith(...t3.childNodes);
    }
    for (; null !== (r2 = P.nextNode()) && d2.length < u2; ) {
      if (1 === r2.nodeType) {
        if (r2.hasAttributes()) for (const t3 of r2.getAttributeNames()) if (t3.endsWith(h)) {
          const i3 = v2[a2++], s2 = r2.getAttribute(t3).split(o), e3 = /([.?@])?(.*)/.exec(i3);
          d2.push({ type: 1, index: l2, name: e3[2], strings: s2, ctor: "." === e3[1] ? I : "?" === e3[1] ? L : "@" === e3[1] ? z : H }), r2.removeAttribute(t3);
        } else t3.startsWith(o) && (d2.push({ type: 6, index: l2 }), r2.removeAttribute(t3));
        if (y.test(r2.tagName)) {
          const t3 = r2.textContent.split(o), i3 = t3.length - 1;
          if (i3 > 0) {
            r2.textContent = s ? s.emptyScript : "";
            for (let s2 = 0; s2 < i3; s2++) r2.append(t3[s2], c()), P.nextNode(), d2.push({ type: 2, index: ++l2 });
            r2.append(t3[i3], c());
          }
        }
      } else if (8 === r2.nodeType) if (r2.data === n) d2.push({ type: 2, index: l2 });
      else {
        let t3 = -1;
        for (; -1 !== (t3 = r2.data.indexOf(o, t3 + 1)); ) d2.push({ type: 7, index: l2 }), t3 += o.length - 1;
      }
      l2++;
    }
  }
  static createElement(t2, i2) {
    const s2 = l.createElement("template");
    return s2.innerHTML = t2, s2;
  }
};
function M(t2, i2, s2 = t2, e2) {
  if (i2 === E) return i2;
  let h2 = void 0 !== e2 ? s2._$Co?.[e2] : s2._$Cl;
  const o2 = a(i2) ? void 0 : i2._$litDirective$;
  return h2?.constructor !== o2 && (h2?._$AO?.(false), void 0 === o2 ? h2 = void 0 : (h2 = new o2(t2), h2._$AT(t2, s2, e2)), void 0 !== e2 ? (s2._$Co ??= [])[e2] = h2 : s2._$Cl = h2), void 0 !== h2 && (i2 = M(t2, h2._$AS(t2, i2.values), h2, e2)), i2;
}
var R = class {
  constructor(t2, i2) {
    this._$AV = [], this._$AN = void 0, this._$AD = t2, this._$AM = i2;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t2) {
    const { el: { content: i2 }, parts: s2 } = this._$AD, e2 = (t2?.creationScope ?? l).importNode(i2, true);
    P.currentNode = e2;
    let h2 = P.nextNode(), o2 = 0, n2 = 0, r2 = s2[0];
    for (; void 0 !== r2; ) {
      if (o2 === r2.index) {
        let i3;
        2 === r2.type ? i3 = new k(h2, h2.nextSibling, this, t2) : 1 === r2.type ? i3 = new r2.ctor(h2, r2.name, r2.strings, this, t2) : 6 === r2.type && (i3 = new Z(h2, this, t2)), this._$AV.push(i3), r2 = s2[++n2];
      }
      o2 !== r2?.index && (h2 = P.nextNode(), o2++);
    }
    return P.currentNode = l, e2;
  }
  p(t2) {
    let i2 = 0;
    for (const s2 of this._$AV) void 0 !== s2 && (void 0 !== s2.strings ? (s2._$AI(t2, s2, i2), i2 += s2.strings.length - 2) : s2._$AI(t2[i2])), i2++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t2, i2, s2, e2) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t2, this._$AB = i2, this._$AM = s2, this.options = e2, this._$Cv = e2?.isConnected ?? true;
  }
  get parentNode() {
    let t2 = this._$AA.parentNode;
    const i2 = this._$AM;
    return void 0 !== i2 && 11 === t2?.nodeType && (t2 = i2.parentNode), t2;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t2, i2 = this) {
    t2 = M(this, t2, i2), a(t2) ? t2 === A || null == t2 || "" === t2 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t2 !== this._$AH && t2 !== E && this._(t2) : void 0 !== t2._$litType$ ? this.$(t2) : void 0 !== t2.nodeType ? this.T(t2) : d(t2) ? this.k(t2) : this._(t2);
  }
  O(t2) {
    return this._$AA.parentNode.insertBefore(t2, this._$AB);
  }
  T(t2) {
    this._$AH !== t2 && (this._$AR(), this._$AH = this.O(t2));
  }
  _(t2) {
    this._$AH !== A && a(this._$AH) ? this._$AA.nextSibling.data = t2 : this.T(l.createTextNode(t2)), this._$AH = t2;
  }
  $(t2) {
    const { values: i2, _$litType$: s2 } = t2, e2 = "number" == typeof s2 ? this._$AC(t2) : (void 0 === s2.el && (s2.el = S.createElement(V(s2.h, s2.h[0]), this.options)), s2);
    if (this._$AH?._$AD === e2) this._$AH.p(i2);
    else {
      const t3 = new R(e2, this), s3 = t3.u(this.options);
      t3.p(i2), this.T(s3), this._$AH = t3;
    }
  }
  _$AC(t2) {
    let i2 = C.get(t2.strings);
    return void 0 === i2 && C.set(t2.strings, i2 = new S(t2)), i2;
  }
  k(t2) {
    u(this._$AH) || (this._$AH = [], this._$AR());
    const i2 = this._$AH;
    let s2, e2 = 0;
    for (const h2 of t2) e2 === i2.length ? i2.push(s2 = new _k(this.O(c()), this.O(c()), this, this.options)) : s2 = i2[e2], s2._$AI(h2), e2++;
    e2 < i2.length && (this._$AR(s2 && s2._$AB.nextSibling, e2), i2.length = e2);
  }
  _$AR(t2 = this._$AA.nextSibling, s2) {
    for (this._$AP?.(false, true, s2); t2 !== this._$AB; ) {
      const s3 = i(t2).nextSibling;
      i(t2).remove(), t2 = s3;
    }
  }
  setConnected(t2) {
    void 0 === this._$AM && (this._$Cv = t2, this._$AP?.(t2));
  }
};
var H = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t2, i2, s2, e2, h2) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t2, this.name = i2, this._$AM = e2, this.options = h2, s2.length > 2 || "" !== s2[0] || "" !== s2[1] ? (this._$AH = Array(s2.length - 1).fill(new String()), this.strings = s2) : this._$AH = A;
  }
  _$AI(t2, i2 = this, s2, e2) {
    const h2 = this.strings;
    let o2 = false;
    if (void 0 === h2) t2 = M(this, t2, i2, 0), o2 = !a(t2) || t2 !== this._$AH && t2 !== E, o2 && (this._$AH = t2);
    else {
      const e3 = t2;
      let n2, r2;
      for (t2 = h2[0], n2 = 0; n2 < h2.length - 1; n2++) r2 = M(this, e3[s2 + n2], i2, n2), r2 === E && (r2 = this._$AH[n2]), o2 ||= !a(r2) || r2 !== this._$AH[n2], r2 === A ? t2 = A : t2 !== A && (t2 += (r2 ?? "") + h2[n2 + 1]), this._$AH[n2] = r2;
    }
    o2 && !e2 && this.j(t2);
  }
  j(t2) {
    t2 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t2 ?? "");
  }
};
var I = class extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t2) {
    this.element[this.name] = t2 === A ? void 0 : t2;
  }
};
var L = class extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t2) {
    this.element.toggleAttribute(this.name, !!t2 && t2 !== A);
  }
};
var z = class extends H {
  constructor(t2, i2, s2, e2, h2) {
    super(t2, i2, s2, e2, h2), this.type = 5;
  }
  _$AI(t2, i2 = this) {
    if ((t2 = M(this, t2, i2, 0) ?? A) === E) return;
    const s2 = this._$AH, e2 = t2 === A && s2 !== A || t2.capture !== s2.capture || t2.once !== s2.once || t2.passive !== s2.passive, h2 = t2 !== A && (s2 === A || e2);
    e2 && this.element.removeEventListener(this.name, this, s2), h2 && this.element.addEventListener(this.name, this, t2), this._$AH = t2;
  }
  handleEvent(t2) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t2) : this._$AH.handleEvent(t2);
  }
};
var Z = class {
  constructor(t2, i2, s2) {
    this.element = t2, this.type = 6, this._$AN = void 0, this._$AM = i2, this.options = s2;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t2) {
    M(this, t2);
  }
};
var B = t.litHtmlPolyfillSupport;
B?.(S, k), (t.litHtmlVersions ??= []).push("3.3.3");

// src/nativepop.js
var POPUP_URL_PATH_PREFIX = "popup-";
var POPUP_HASH_PREFIX = `#${POPUP_URL_PATH_PREFIX}`;
var DEFAULT_POPUP_URL_PATH = "popup-test";
var ICON_PATHS = {
  pencil: "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z",
  renameBox: "M18,17H10.5L12.5,15H18M6,17V14.5L13.88,6.65C14.07,6.45 14.39,6.45 14.59,6.65L16.35,8.41C16.55,8.61 16.55,8.92 16.35,9.12L8.47,17M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z",
  deleteOutline: "M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19M8,9H16V19H8V9M15.5,4L14.5,3H9.5L8.5,4H5V6H19V4H15.5Z"
};
var currentDialog = null;
var currentPopupUrlPath = null;
var dialogOpenedViaHash = false;
var dialogPushedByUs = false;
var weSetHashOurselves = false;
function getHass() {
  const haEl = document.querySelector("home-assistant");
  return haEl ? haEl.hass : void 0;
}
function isNarrow() {
  const haEl = document.querySelector("home-assistant");
  return !!(haEl && haEl.narrow);
}
function sanitizeDialogWidth(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return /^\d+(\.\d+)?(px|%|vw|rem|em)$/.test(trimmed) ? trimmed : null;
}
function fireLocationChanged() {
  window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
}
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
        `NativePop: popup "${popupUrlPath}" requested while "${currentPopupUrlPath}" is already open \u2014 ignoring (one popup at a time in v1)`
      );
    }
    return;
  }
  if (!hass) {
    console.error("NativePop: no hass object available yet");
    return;
  }
  const dialog = document.createElement("ha-adaptive-dialog");
  dialog.headerTitle = "NativePop";
  dialog.width = "medium";
  dialog.allowModeChange = true;
  dialog.open = true;
  if (!isNarrow()) {
    dialog.style.setProperty("--ha-dialog-width-md", "min(90vw, 1024px)");
  }
  const content = document.createElement("div");
  content.className = "nativepop-loading";
  content.innerHTML = `<div class="nativepop-spinner"></div><span>Loading popup\u2026</span>`;
  dialog.appendChild(content);
  currentDialog = dialog;
  currentPopupUrlPath = popupUrlPath;
  dialogOpenedViaHash = viaHash;
  dialogPushedByUs = pushedByUs;
  dialog.addEventListener("closed", () => {
    dialog.remove();
    currentDialog = null;
    currentPopupUrlPath = null;
    const wasViaHash = dialogOpenedViaHash;
    const wasPushedByUs = dialogPushedByUs;
    dialogOpenedViaHash = false;
    dialogPushedByUs = false;
    if (!wasViaHash || matchPopupUrlPath(location.hash) !== popupUrlPath) {
      return;
    }
    if (wasPushedByUs) {
      history.back();
    } else {
      history.replaceState(null, "", location.pathname + location.search);
    }
  });
  document.body.appendChild(dialog);
  let lovelaceConfig;
  try {
    lovelaceConfig = await hass.callWS({
      type: "lovelace/config",
      url_path: popupUrlPath
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
    return;
  }
  if (!isNarrow()) {
    const customWidth = sanitizeDialogWidth(
      lovelaceConfig.views && lovelaceConfig.views[0] && lovelaceConfig.views[0].nativepop_dialog_width
    );
    if (customWidth) {
      dialog.style.setProperty("--ha-dialog-width-md", customWidth);
    }
  }
  const lovelace = {
    config: lovelaceConfig,
    rawConfig: lovelaceConfig,
    editMode: false,
    urlPath: popupUrlPath,
    mode: "storage",
    locale: hass.locale,
    enableFullEditMode: () => {
    },
    setEditMode: () => {
    },
    saveConfig: async () => {
    },
    deleteConfig: async () => {
    },
    showToast: () => {
    }
  };
  const view = document.createElement("hui-view");
  view.hass = hass;
  view.lovelace = lovelace;
  view.index = 0;
  view.narrow = false;
  content.remove();
  dialog.appendChild(view);
}
function closeNativePopDialog() {
  if (currentDialog) {
    currentDialog.open = false;
  }
}
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
window.addEventListener("ll-custom", (ev) => {
  const popupUrlPath = ev.detail && ev.detail.nativepop_popup;
  if (popupUrlPath) {
    openNativePopDialog(getHass(), popupUrlPath, { viaHash: false });
  }
});
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
var NATIVEPOP_EVENT_TYPE = "nativepop_open_popup";
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
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
var POPUP_FORM_SCHEMA = [
  { name: "title", required: true, selector: { text: {} } },
  { name: "width", required: false, selector: { text: {} } }
];
function computePopupFormLabel(schema) {
  if (schema.name === "title") {
    return "Name";
  }
  if (schema.name === "width") {
    return "Dialog width (desktop only)";
  }
  return schema.name;
}
function computePopupFormHelper(schema) {
  if (schema.name === "width") {
    return 'e.g. "800px" or "70%" - leave blank for the default. Narrow/mobile screens always open as a full-width swipeable sheet instead, regardless of this setting.';
  }
  return "";
}
function showNativePopFormDialog(hass, { heading, data, confirmLabel }) {
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
    form.schema = POPUP_FORM_SCHEMA;
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
var NativePopPanel = class extends HTMLElement {
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
        template: () => b`<ha-icon icon="mdi:window-restore"></ha-icon>`
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
        template: (popup) => b`
          <div>${popup.title}</div>
          <div
            style="color: var(--secondary-text-color); font-size: 12px; cursor: pointer; width: fit-content;"
            title="Click to copy"
            @click=${(ev) => {
          ev.stopPropagation();
          this._copyToClipboard(`#${popup.url_path}`);
        }}
          >
            #${popup.url_path}
          </div>
        `
      },
      url_path: {
        title: "URL path",
        hidden: true,
        filterable: true
      },
      actions: {
        title: "",
        minWidth: "144px",
        maxWidth: "144px",
        showNarrow: true,
        // Three plain ha-icon-buttons instead of an overflow menu - Mikkel
        // wants all three actions visible on the row, not collapsed behind
        // a "⋮". Using .path= directly (real SVG data, see ICON_PATHS) now
        // that real Lit templates are available, rather than the
        // slotted-<ha-icon> fallback used before the build step existed.
        template: (popup) => b`
          <div style="display: flex;">
            <ha-icon-button
              .path=${ICON_PATHS.renameBox}
              label="Rename"
              @click=${(ev) => {
          ev.stopPropagation();
          this._renamePopup(popup);
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
        `
      }
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
      menuBtn.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
      });
    } else {
      menuBtn.style.display = "none";
    }
    this._table = this.querySelector("#table");
    this._table.columns = this._columns();
    this._table.searchLabel = "Search popups";
    this._table.noDataText = "No popups yet \u2014 create one to get started.";
    this._table.addEventListener("row-click", (ev) => {
      const popup = (this._popups || []).find((p2) => p2.id === ev.detail.id);
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
    this._popups = dashboards.filter((d2) => d2.url_path && d2.url_path.startsWith(POPUP_URL_PATH_PREFIX)).sort((a2, b2) => a2.title.localeCompare(b2.title));
    loadingEl.hidden = true;
    this._table.hidden = false;
    this._table.hass = this._hass;
    this._table.data = this._popups;
  }
  _showToast(message) {
    this.dispatchEvent(
      new CustomEvent("hass-notification", { detail: { message }, bubbles: true, composed: true })
    );
  }
  async _copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
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
    let config;
    try {
      config = await this._hass.callWS({ type: "lovelace/config", url_path: popup.url_path });
    } catch (err) {
      console.error("NativePop: could not load popup config for rename", err);
      alert("NativePop: could not load popup. See console for details.");
      return;
    }
    const currentWidth = config.views && config.views[0] && config.views[0].nativepop_dialog_width || "";
    const result = await showNativePopFormDialog(this._hass, {
      heading: "Rename popup",
      data: { title: popup.title, width: currentWidth },
      confirmLabel: "Save"
    });
    if (!result) {
      return;
    }
    const newTitle = (result.title || "").trim();
    const newWidth = sanitizeDialogWidth(result.width) || "";
    const titleChanged = newTitle && newTitle !== popup.title;
    const widthChanged = newWidth !== currentWidth;
    if (!titleChanged && !widthChanged) {
      return;
    }
    if (titleChanged) {
      try {
        await this._hass.callWS({
          type: "lovelace/dashboards/update",
          dashboard_id: popup.id,
          title: newTitle
        });
      } catch (err) {
        console.error("NativePop: could not rename popup dashboard", err);
        alert("NativePop: could not rename popup. See console for details.");
        return;
      }
    }
    if (widthChanged) {
      const views = config.views ? [...config.views] : [{ type: "sections", sections: [] }];
      const view = { ...views[0] };
      if (newWidth) {
        view.nativepop_dialog_width = newWidth;
      } else {
        delete view.nativepop_dialog_width;
      }
      views[0] = view;
      try {
        await this._hass.callWS({
          type: "lovelace/config/save",
          url_path: popup.url_path,
          config: { ...config, views }
        });
      } catch (err) {
        console.error("NativePop: could not save popup dialog width", err);
        alert("NativePop: could not save the dialog width. See console for details.");
      }
    }
    await this._refresh();
  }
  async _createPopup() {
    const result = await showNativePopFormDialog(this._hass, {
      heading: "Create popup",
      data: { title: "", width: "" },
      confirmLabel: "Create"
    });
    if (!result) {
      return;
    }
    const title = (result.title || "").trim();
    if (!title) {
      return;
    }
    const width = sanitizeDialogWidth(result.width);
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
    if (dashboards.some((d2) => d2.url_path === urlPath)) {
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
        require_admin: false
      });
    } catch (err) {
      console.error("NativePop: could not create popup dashboard", err);
      alert("NativePop: could not create popup. See console for details.");
      return;
    }
    const viewConfig = { title, type: "sections", sections: [] };
    if (width) {
      viewConfig.nativepop_dialog_width = width;
    }
    try {
      await this._hass.callWS({
        type: "lovelace/config/save",
        url_path: urlPath,
        config: { views: [viewConfig] }
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
};
customElements.define("nativepop-panel", NativePopPanel);
var NativePopPocCard = class extends HTMLElement {
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
          composed: true
        })
      );
    });
    this.querySelector("#hash-btn").addEventListener("click", () => {
      weSetHashOurselves = true;
      location.hash = this._popup;
    });
  }
  getCardSize() {
    return 2;
  }
};
customElements.define("nativepop-poc-card", NativePopPocCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "nativepop-poc-card",
  name: "NativePop PoC",
  description: "Proof-of-concept test harness trigger for NativePop popups."
});
console.info("NativePop: milestone 5 loaded (panel now uses ha-data-table: sortable columns, search, overflow menu)");
/*! Bundled license information:

lit-html/lit-html.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/

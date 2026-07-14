# NativePop

Native Home Assistant popups. Build popup content with HA's real dashboard
editor (card picker, sections/grid layout), then trigger any popup as a
modal dialog from any card, any dashboard, any automation — no custom card
layout engine, no `browser_mod` dependency.

Each popup is just a real HA storage dashboard (hidden from the sidebar).
NativePop reuses HA's own dashboard create/edit/render machinery instead of
reimplementing a card picker or grid system, and gives you a sidebar panel
to manage them plus several ways to trigger them.

## Features

- **Sidebar panel ("Popup Manager")** to list, search, create, edit, and
  delete popups, with per-popup settings (rename, header/subheader text,
  dialog width, custom CSS).
- **Three ways to trigger a popup**:
  - `tap_action: navigate` to a `#popup-<slug>` hash — fully visual-editor
    friendly, works from any card.
  - `tap_action: fire-dom-event` — works from any card without a wrapper,
    YAML-only (HA's visual action picker doesn't offer this action anymore).
  - An automation's built-in **"Fire an event"** action — open a popup with
    no tap involved at all (e.g. a security alert).
- Popups render as a real HA dashboard view inside a dialog — any native or
  HACS card works inside one, exactly as it would on a normal dashboard.
- Swipe-to-close on mobile/narrow screens; a normal dialog on desktop.

## Installation

1. In Home Assistant: **HACS → ⋮ menu → Custom repositories**, add this
   repository's URL with category **Integration**.
2. Install **NativePop** through HACS.
3. **Settings → Devices & services → Add Integration**, search for
   "NativePop", and confirm the single (field-free) setup step.
4. **Popup Manager** should now appear in the sidebar automatically — no
   `configuration.yaml` editing needed.

## Creating a popup

1. Open **Popup Manager** from the sidebar.
2. Click **+ New popup** and give it a name (e.g. "Washing machine"). This
   generates its `url_path` (e.g. `popup-washing-machine`) and creates a
   hidden dashboard.
3. You're dropped straight into that dashboard's normal edit mode — build
   its content with HA's real card picker and sections/grid layout, exactly
   like any other dashboard.
4. Close edit mode when you're done. That's it — the popup is ready to
   trigger from anywhere.

Renaming only changes the display title; the `url_path` (and therefore
every trigger pointing at it) stays fixed, so existing triggers never break
when you rename a popup.

## Triggering a popup

Every popup's `url_path` doubles as its trigger identifier. If a popup's
`url_path` is `popup-washing-machine`, use `popup-washing-machine` (or
`#popup-washing-machine` for the hash form) in any of the following:

### From a tap (recommended): `navigate`

Works on any card, fully configurable through HA's visual editor:

```yaml
tap_action:
  action: navigate
  navigation_path: "#popup-washing-machine"
```

This is also deep-linkable and back-button aware — navigating to that hash
directly (a bookmark, a shared link, browser back/forward) opens or closes
the popup the same way a tap would.

### From a tap (fallback): `fire-dom-event`

Works on any card too, but YAML-only — HA's visual action picker doesn't
expose this action:

```yaml
tap_action:
  action: fire-dom-event
  nativepop_popup: popup-washing-machine
```

### From an automation, no tap involved

Any automation can open a popup on its own, using HA's built-in, visually
editable **"Fire an event"** action:

```yaml
actions:
  - event: nativepop_open_popup
    event_data:
      popup: popup-washing-machine
```

This broadcasts to every connected frontend session — there's currently no
way to target a specific browser or user.

## Popup settings

Each popup in Popup Manager has three actions: **Edit** (opens the
dashboard's edit mode), **Delete**, and **⚙ Settings**. Settings covers
everything about how a popup presents itself when it opens:

- **Name** — the display title (rename; doesn't affect the trigger
  identifier).
- **Popup header / subheader** — text shown at the top of the popup's
  dialog. Blank by default (no title shown at all).
- **Dialog width** (desktop only) — free text, so either a pixel or percent
  value works (e.g. `800px`, `70%`). Leave blank for the default. Narrow
  screens/the companion app always get a full-width sheet regardless of
  this setting.
- **Custom CSS variables** — free text, one `--variable: value;` per line,
  applied directly to the popup's dialog. See the reference below for which
  variables actually do something.

## Popup dialog CSS variables

The "Custom CSS variables" field (in a popup's Settings) applies to **both**
the popup's dialog (for chrome-level variables) and its content (for
content-level variables) — the table below notes which is which.

| Variable | Default | Effect | Applies to |
|---|---|---|---|
| `--ha-dialog-max-height` | `calc(var(--safe-height) - var(--ha-space-20))` | Caps the dialog's height | dialog |
| `--ha-dialog-min-height` | *(none)* | Forces a minimum height | dialog |
| `--ha-dialog-border-radius` | `var(--ha-border-radius-3xl)` | Corner rounding | dialog |
| `--ha-dialog-surface-background` | `var(--card-background-color, --ha-color-surface-default)` | Dialog background | dialog |
| `--dialog-content-padding` | `0 var(--ha-space-6) var(--ha-space-6) var(--ha-space-6)` | Padding around the dialog's content area | dialog |
| `--dialog-surface-margin-top` | `auto` | Vertical position within the viewport | dialog |
| `--ha-dialog-header-title-color` | `var(--primary-text-color)` | Header title text color | dialog |
| `--ha-dialog-header-title-font-size` | `var(--ha-font-size-2xl)` | Header title text size | dialog |
| `--ha-dialog-header-title-font-weight` | `var(--ha-font-weight-normal)` | Header title text weight | dialog |
| `--ha-dialog-header-title-line-height` | `var(--ha-line-height-condensed)` | Header title line height | dialog |
| `--ha-view-sections-column-gap` | `0` by default here (native default: 32px, ≥600px width) | The sections view's own grid gutter | view |
| `--ha-view-sections-narrow-column-gap` | `0` by default here (native default: 8px, <600px width) | Same, <600px width | view |

Don't set `--ha-dialog-width-*` here — use the dedicated "Dialog width"
field instead, which is applied to `--ha-dialog-width-md` specifically; a
line for it here would apply afterward and silently override that field.

Header/subheader text itself isn't a CSS variable — use the "Popup
header"/"Popup subheader" fields instead.

## Known limitations

- Automation-triggered popups broadcast to every connected frontend
  session — there's no way to target a specific browser or user in this
  version.
- No metadata registry — which dashboards count as popups is determined
  purely by `url_path` starting with `popup-`.
- Not yet tested on the iOS/Android companion apps specifically (only
  narrow-browser-window testing so far).

## Development

`src/nativepop.js` is the real source; `custom_components/nativepop/www/nativepop.js`
(what HACS/HA actually serve) is a **build artifact**, bundled via esbuild,
and must be committed alongside any source change:

```bash
npm install     # first time only
npm run build   # after any change to src/nativepop.js
```

The build step exists because the Popup Manager's list (`ha-data-table`)
needs `lit-html`'s `html` tag for its column templates — everything else in
this project is plain, dependency-free JS. A GitHub Actions workflow
(`.github/workflows/verify-build.yml`) fails CI if `src/` changes without a
matching rebuild.

See [ha-popup-builder-spec.md](ha-popup-builder-spec.md) for the full
technical design and architecture notes.

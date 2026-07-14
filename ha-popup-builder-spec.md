# NativePop — Technical Spec

**Repo description:** Native Home Assistant popups — build popup content with HA's
real dashboard editor, trigger via tap or navigation, reusable across dashboards.

**GitHub/HACS topics:** `home-assistant`, `hacs`, `lovelace`, `popup`, `dashboard`,
`custom-card`, `frontend`

## 1. Summary

A system that lets a user build and manage reusable "popups" for Home Assistant
Lovelace dashboards using HA's **native** dashboard editor (card picker, grid/sections
layout, drag-resize), then trigger any of those popups as a modal dialog from any card
on any dashboard — either directly (tap) or via URL navigation (deep link).

Popups are **not** a new bespoke card layout engine. Each popup is a real HA storage
dashboard (single view, `show_in_sidebar: false`) — we reuse HA's own dashboard
create/edit/render machinery instead of reimplementing a card picker or grid system.

## 2. Goals

- Build popup content with the real Lovelace UI editor (card picker + sections/grid),
  not a custom clone of it.
- Popups are reusable: define once, trigger from any card, any dashboard, any view.
- Support both trigger styles Bubble Card offers: direct tap trigger, and
  navigation/hash-based trigger (deep-linkable, back-button aware). Also support
  automations opening a popup with no tap involved at all (e.g. a security alert),
  via HA's built-in "Fire an event" action.
- Sidebar panel to list, create, rename, delete, and jump into editing popups.
- No dependency on `browser_mod`.

## 3. Core requirement: stay native, support two trigger paths

Two things drive most decisions in this spec:

1. **Maximize reuse of native HA internals** — for the picker, the grid, and the
   rendering, always prefer wiring into HA's real dashboard/view machinery over
   building bespoke UI, even where it means depending on undocumented internals.
2. **Popups must be triggerable two ways**, matching what Bubble Card offers:
   - **Direct trigger** — `tap_action` / `fire-dom-event` opens the dialog immediately,
     no URL change. Good for in-place interactions (e.g. tap a light tile, get a
     popup, close it, you're still where you were).
   - **Navigation trigger** — a URL hash (or query param) identifies the popup, e.g.
     `#popup-washing-machine`. Navigating to that hash (via `tap_action: navigate`,
     a plain link, browser back/forward, or an externally shared URL) opens the
     popup; navigating away or hitting back closes it. This makes popups
     deep-linkable/bookmarkable and gives correct back-button behavior, which the
     event-only trigger can't provide on its own.

Both paths funnel into the *same* underlying dialog/mount logic (5.3) — the only
difference is what initiates it (a DOM event vs. a `hashchange`/history listener).

## 4. Non-goals (v1)

- No custom grid/layout engine — we inherit whatever HA's native sections view supports.
- No popup-specific card types (sliders, custom buttons, etc.) — any existing card
  (native or HACS) can be used inside a popup, same as any dashboard view.
- No cross-instance sharing/marketplace of popups.
- No animation/transition customization beyond a basic open/close treatment in v1.

## 5. Architecture

### 5.1 Popups are hidden storage dashboards

- Each popup = one HA storage dashboard:
  - `show_in_sidebar: false`
  - Single view, `type: sections` (native grid) by default
  - URL path prefixed for identification, e.g. `popup-<slug>` — this slug doubles as
    the hash/identifier used by the navigation trigger (5.4)
- Created/edited/deleted via HA's existing dashboard WebSocket API — no new backend
  storage needed beyond what dashboards already use.
- Editing a popup = opening that dashboard's normal edit mode. We do not build a
  custom editor UI for card content at all.

### 5.2 Sidebar panel ("Popup Manager")

A custom panel, registered via `panel_custom.async_register_panel()` from the
companion integration's Python (see 5.7) — not a manual `configuration.yaml`
entry — providing:

- List of all popup dashboards (filtered by URL path prefix or a config registry —
  see 5.5), rendered as a real `ha-data-table`, full width *(done, milestone 5)* —
  the same component Settings > Dashboards uses (`ha-config-lovelace-dashboards.ts`),
  not an approximation. Gets sortable columns, clickable rows (opens edit mode), and
  a built-in search box (automatic once a column is `filterable` — no custom search
  code needed, satisfying the "add search" ask directly) for free. This is what
  forced the build-step reversal in 5.8. Row actions (Settings/Edit/Delete) render as
  three plain `ha-icon-button`s directly on the row, not the native page's overflow
  ("⋮") menu — tried that first since it's what the reference file uses, but three
  actions behind one menu was judged more clicks than wanted for a list this size.
- Create new popup — name only (generates the slug/url_path); opens it in edit mode.
  Everything about how the popup *presents itself* (below) is deliberately not a
  creation-time decision — it lives in Settings instead, editable any time.
- Popup settings (⚙ icon, repurposed from a plain "Rename" — done, milestone 5):
  - Rename: changes the `title` only (via `lovelace/dashboards/update`) — the
    `url_path`/slug stays fixed, since triggers (hash, fire-dom-event, automations)
    are wired to it and silently changing it would break every existing reference.
  - Popup header / subheader — free text, shown at the top of the popup's dialog when
    it opens (`.headerTitle`/`.headerSubtitle` on the dialog — see 5.3). Blank by
    default (no more hardcoded "NativePop" title). Saved as `nativepop_header` /
    `nativepop_subheader` on the popup's own dashboard view config.
  - Per-popup dialog width — a free-text field (not a size preset), so either a px or
    % value works. Saved as `nativepop_dialog_width` on the same view config. Desktop
    only by design (see 5.3); narrow/mobile always gets the full-width dialog
    regardless, and the field's helper text says so.
  - Custom CSS variables — a free-text, multiline field (`ha-form`'s `text.multiline`
    selector), one `--variable: value;` per line, applied directly to the popup's
    dialog element (`applyCustomCssVariables()` — parses only `--name: value` pairs,
    nothing else, so it can't inject arbitrary CSS/JS). Saved as
    `nativepop_css_variables`. Its helper text points at the README's own reference
    list of which variables actually do something, rather than duplicating that list
    in two places.
  All four of the above piggyback on the same dashboard view config object
  `type: sections` already lives on — no new metadata store (5.5/5.6 still holds).
- Copy popup slug/hash to clipboard *(done, milestone 5)* — click-to-copy on each row's
  `#url_path` text, with a native-style toast confirmation (`hass-notification` event).
  Falls back to `execCommand("copy")` when `navigator.clipboard` isn't available (no
  secure context, e.g. plain-HTTP local instances). Copying a ready-to-paste example
  trigger YAML snippet (not just the bare slug) is still a nice-to-have, not built.
- Optional: quick preview (render the popup's view read-only in a dialog).

This panel is mostly CRUD UI wrapping existing dashboard WS commands. No rendering
internals needed here.

### 5.3 Dialog mount (shared by both trigger paths)

A small custom element/module that:

1. Accepts a target popup slug.
2. Fetches the target popup dashboard's view config via `lovelace/config` (or the
   equivalent per-dashboard WS command).
3. Opens an `ha-dialog` (or similar) and mounts a `hui-view` (or `hui-card` per card
   if a full view proves too heavy) inside it, passing `hass` and the fetched config.
4. Handles teardown/cleanup on dialog close (unmounting the view, removing listeners,
   and — if opened via navigation — reverting the URL hash on close).

This is the one component touching an **undocumented internal** (`hui-view`). Scope
should be kept minimal — a thin mount/unmount wrapper, not a fork.

**Dialog width** *(done, milestone 5)*: defaults to `min(90vw, 1024px)` via the
`--ha-dialog-width-md` custom property (the tier `ha-dialog` reads by default —
see `src/components/ha-dialog.ts`), overridable per popup (5.2). The override is
applied only when `isNarrow()` (HA's own already-computed narrow/mobile flag, read
straight off the `<home-assistant>` root element — same escape hatch as `hass`
itself, see 7) is false. On narrow viewports the custom property is left untouched
entirely, so `ha-dialog`'s own default (already viewport-safe) behavior governs —
deliberately not reimplemented ourselves, to avoid the risk of guessing HA's
internal breakpoint wrong.

**Header/subheader/custom CSS** *(done, milestone 5)*: no default title (previously
hardcoded to "NativePop") — `dialog.headerTitle`/`.headerSubtitle` are only set if
the popup's own settings (5.2) define `nativepop_header`/`nativepop_subheader`,
applied once the config fetch resolves, same as width. Unlike width, these (and any
custom CSS variables) apply regardless of `isNarrow()` — only the *width* override
is desktop-only by design; header text and arbitrary CSS variables aren't inherently
a desktop-vs-mobile concern the way a fixed pixel width is.

**Content padding** *(done, milestone 5)*: two separate horizontal-padding sources
were insetting popup content from the dialog edges, both zeroed unconditionally
(not a per-popup setting) and both applied before the popup's own custom CSS
variables (5.2), so either can still be explicitly reintroduced per popup via that
field if wanted:
- `--dialog-content-padding` — `ha-dialog`'s own `.body` padding, defaults to the
  shorthand `0 var(--ha-space-6) var(--ha-space-6) var(--ha-space-6)`.
- `--column-gap` — `hui-sections-view`'s own `.wrapper` div padding (`0
  var(--column-gap)`), defaults to 8px narrow / 32px desktop. This turned out to be
  the actual cause of the reported misalignment — the first fix
  (`--dialog-content-padding` alone) was real and independently correct, but wasn't
  what was actually visible; found by reading `hui-sections-view.ts`'s source after
  the first guess didn't match what was reported (an 8px measurement, which doesn't
  match `--ha-space-6`).

**Dialog component** *(done, milestone 5)*: both the popup content dialog and the
create/rename form dialog use `ha-adaptive-dialog` (added HA 2026.3), not plain
`ha-dialog` — a real `ha-dialog` on desktop (>870px wide and >500px tall, per its
source — confirms the same breakpoint `isNarrow()` above is built on) and a real
`ha-bottom-sheet` below that, with genuine swipe-to-close (a gesture recognizer
tracking touch position, closing on a downward swipe — verified in
`ha-bottom-sheet`'s own source, not assumed). In desktop mode it composes an actual
nested `<ha-dialog>` internally and forwards `.width`/`.headerTitle`/etc., so the
per-popup width override above needed no changes to keep working.

### 5.4 Trigger paths (both call into 5.3)

- **Navigation trigger (primary)**: a global `hashchange`/`popstate`/`location-changed`
  listener (registered once, e.g. from the sidebar panel's module or a lightweight
  always-loaded resource) watches for the `#popup-<slug>` pattern. On match, opens the
  dialog via 5.3; on hash removal (back button, manual navigation away), closes it.
  `tap_action: navigate` with `navigation_path: "#popup-<slug>"` is the recommended way
  to open a popup from any card (tile cards, navbar cards, etc.) — it's fully
  visual-editor friendly and matches Bubble Card's `hash:` behavior. Note:
  `tap_action: navigate` uses `history.pushState()` internally, which does **not** fire
  `hashchange`/`popstate` — HA fires its own `location-changed` event after navigate(),
  which the listener must also watch for.
- **Direct trigger (fallback, YAML-only)**: `tap_action: { action: fire-dom-event, ... }`
  with the target popup slug as a payload key, dispatched as a bubbling/composed
  `ll-custom` DOM event. Works from any card without a wrapper, but HA removed
  `fire-dom-event` from the visual action picker (YAML-only now), so this is kept as a
  working fallback rather than the primary trigger — resolves open question 9.1 in
  favor of "generic action, no wrapper card," but in practice `navigate` covers the
  real usage pattern (tile cards/navbars) better.

### 5.5 Automation trigger (no tap involved)

A third trigger path, for popups an automation opens on its own (e.g. a security
alert), with no card/tap involved at all:

- Automations use HA's built-in, visually-editable **"Fire an event"** action — no
  custom backend/integration needed:
  ```yaml
  actions:
    - event: nativepop_open_popup
      event_data:
        popup: popup-security
  ```
- The frontend subscribes to that event type via `hass.connection.subscribeEvents()`
  (standard `home-assistant-js-websocket` API) and opens the dialog via 5.3, same as a
  direct trigger (no URL change).
- This broadcasts to every connected frontend session, same as any other HA event —
  there's no per-browser/per-user targeting in v1. We do have a companion integration
  now (5.7), so this is no longer a hard architectural blocker like it was when 5.6 was
  first written — but per-target delivery would need the integration to track
  registered browsers/sessions (à la `browser_mod`), which is real additional work, not
  a side effect of already having a backend. Deferred to v2 (milestone 6).

### 5.6 Registry / metadata

Need a lightweight way to track "which dashboards are popups" beyond just URL prefix
matching, to support renaming, filtering the sidebar list cleanly, and future metadata
(e.g. default dialog size, close behavior). Options to evaluate:

- Store metadata as a JSON blob via the companion integration's own storage (see 5.7 —
  cheaper now than when this was first written, since the integration already exists),
  **or**
- Piggyback on dashboard `title`/`url_path` naming convention only (simpler, what v1
  actually uses).

**Decision (still holds through milestone 4)** — naming-convention-only, no metadata
storage yet. Revisit only if/when metadata needs grow (e.g. milestone 5 rename support
turns out to need more than a WS `update` call).

### 5.7 Delivery model: companion integration

Originally scoped as a frontend-only HACS "plugin" (Lovelace resource + manual
`panel_custom` YAML for the sidebar panel — see the old wording in 5.2/5.4/5.6 history).
Revised at milestone 4 after finding a working, already-proven pattern in a sibling
project ([ha-meal-planer](https://github.com/bymem/ha-meal-planer)) for delivering
exactly this kind of frontend-only functionality with better ergonomics:

- **`custom_components/nativepop/`** — a minimal HA integration. `manifest.json` +
  `config_flow.py` implement a single-step, config-free setup ("Add Integration" →
  confirm, done — no fields, single-instance).
- **`async_setup()`** (runs once per HA process) registers a static path serving
  `custom_components/nativepop/www/nativepop.js` (`hass.http.async_register_static_paths`),
  and auto-loads that same module on every frontend page via
  `homeassistant.components.frontend.add_extra_js_url()` — this is what the trigger
  listeners (5.4/5.5) need to always be live, and resolves the open question about
  where a "global" hash listener can reliably live (see 9).
- **`async_setup_entry()`** (runs when the config entry is added) registers the
  "Popup Manager" sidebar panel via `panel_custom.async_register_panel()` — no manual
  YAML.
- HACS category is **`integration`**, not `plugin`/dashboard — this matters because
  HACS's `integration` category only copies `custom_components/` into the HA config
  dir; it does not manage a `www/community/` folder or `/hacsfiles/` URLs the way the
  `plugin` category does. The JS is served entirely by the integration's own static
  path instead.
- None of the actual trigger/dialog-mount logic changed — this is purely a delivery
  upgrade (packaging + registration), not a rewrite of 5.3/5.4/5.5.
- Trade-off accepted: this does add a small Python backend, which the original 5.6
  decision explicitly avoided for v1. Judged worth it because (a) the pattern was
  already proven working in a sibling project, so it wasn't new/unknown risk, and
  (b) it removes both a manual YAML step and an unverified assumption about
  Lovelace-resource load timing.

### 5.8 Frontend build step

Originally scoped as a single plain JS file, no build tooling at all (see the
project's very first milestone) — a deliberate simplicity choice, and one that held
through milestone 4. Reversed at milestone 5, when the Popup Manager panel's list
needed to become a real `ha-data-table` (the actual component Settings > Dashboards
uses, not an approximation — see 5.2) to genuinely support search/sort/an overflow
menu rather than hand-rolled equivalents.

- The blocker: `ha-data-table` column cells needing anything beyond plain text
  (icons, the overflow menu) require a `column.template` function returning a real
  Lit `TemplateResult` — a plain HTML string gets auto-escaped as literal text by
  Lit's own XSS protection, not parsed as markup. That needs `lit-html`'s `html` tag,
  which isn't reachable without bundling.
- `src/nativepop.js` is now the real source (imports `lit-html`);
  `custom_components/nativepop/www/nativepop.js` is a **build artifact** (esbuild,
  see `package.json`), committed to the repo since HACS/HA copy
  `custom_components/` as-is with no build step of their own — whatever's committed
  there is exactly what installs.
- A GitHub Actions workflow (`.github/workflows/verify-build.yml`) rebuilds from
  source on every push touching `src/` or the build output, and fails CI if the
  committed artifact doesn't match — catches a forgotten `npm run build` before it
  reaches a release.
- Scope stayed narrow: `lit-html` (the templating runtime) is used *only* for
  `ha-data-table`'s column templates. Everything else in the project — the trigger
  listeners, the dialog mount, the create/rename dialog, the two custom elements —
  stays plain, dependency-free JS, unchanged by this pivot.
- Multiple `lit-html` copies (ours, bundled; HA's own, already loaded) coexisting on
  one page is safe by design — lit-html's `TemplateResult` recognition is duck-typed
  (a marker property), not an `instanceof`/module-identity check, specifically so
  independently-bundled consumers don't conflict.

## 6. Data flow

```
[User taps card — direct trigger]
  -> tap_action fires -> fire-dom-event with popup slug
  -> dialog mount (5.3): fetch dashboard config for popup's url_path
  -> mount hui-view with fetched config inside ha-dialog
  -> user interacts with real HA cards inside dialog
  -> on close: unmount, cleanup
```

```
[User navigates to #popup-<slug> — navigation trigger]
  -> hashchange listener detects match
  -> dialog mount (5.3): fetch dashboard config for popup's url_path
  -> mount hui-view with fetched config inside ha-dialog
  -> user interacts with real HA cards inside dialog
  -> on close (or back button): unmount, revert hash, cleanup
```

```
[Automation fires — no tap involved]
  -> automation action: event: nativepop_open_popup, event_data: {popup: <url_path>}
  -> frontend's hass.connection.subscribeEvents() callback fires
  -> dialog mount (5.3): fetch dashboard config for popup's url_path
  -> mount hui-view with fetched config inside ha-dialog
  -> user interacts with real HA cards inside dialog
  -> on close: unmount, cleanup (no hash/history involved)
```

```
[User opens sidebar "Popup Manager"]
  -> list dashboards matching popup convention/registry
  -> create: WS call to create dashboard (show_in_sidebar: false, url_path: popup-*)
  -> edit: navigate to that dashboard's native edit mode
  -> delete/rename: WS calls against existing dashboard config API
```

## 7. Key technical risks

| Risk | Notes | Mitigation |
|---|---|---|
| `hui-view` is undocumented/internal | Behavior/shape may change across HA releases | Keep the mount wrapper thin and isolated; pin tested HA versions; monitor changelogs |
| Dialog sizing/responsiveness of a full view in a modal | Sections view assumes a full-page context | *(Improved, milestone 5)* Desktop: widened default + per-popup override (5.3). Mobile: `ha-adaptive-dialog` gives a real bottom-sheet with swipe-to-close instead of a resized dialog. Still untested on the actual companion app (see next row) |
| Hash trigger conflicts | Other cards/integrations may also use URL hashes (e.g. anchor links, other custom cards) | Namespace the hash pattern clearly (`#popup-...`) to avoid collisions |
| Hidden dashboards showing up unexpectedly (search, quick-bar, voice) | `show_in_sidebar: false` hides nav but may not hide from all HA surfaces | Verify behavior across HA search/quick-bar; document known limitations |
| Storage dashboard count at scale | Many popups = many dashboards in `.storage/lovelace.*` | Acceptable for personal use scale; not a concern at Mikkel's scope |
| Companion app (iOS) parity | Custom elements/dialogs, and hash-based navigation, sometimes behave differently in the app's webview | Test explicitly on iOS companion app, not just desktop browser |
| Automation-triggered popups have no targeting | `nativepop_open_popup` events broadcast to every connected frontend session, not a specific browser/user | Document as a known v1 limitation; per-target delivery needs the integration to track registered browsers/sessions (à la `browser_mod`) — real work, deferred to v2 (see 5.5, 8) |
| Companion integration adds a small Python backend | Contradicts the original 5.6 decision to avoid a backend for v1 | Accepted trade-off at milestone 4 (see 5.7) — the pattern was already proven in a sibling project, and it removes a manual YAML step plus an unverified resource-load-timing assumption |

## 8. Milestones

1. **Proof of concept**: manually create a hidden dashboard, write a static trigger
   that hardcodes fetching that one dashboard's config and mounts `hui-view` in
   a dialog via direct trigger only. Validate the core idea before building tooling.
2. **Navigation trigger**: add the `hashchange`/`popstate` listener and wire it into
   the same dialog mount from step 1. Validate deep-link + back-button behavior.
3. **Trigger element v1** *(done)*: generalized both trigger paths into
   reusable, slug-driven mechanisms; resolved the `fire-dom-event` vs. `navigate`
   question in favor of `navigate` as the primary tap trigger (see 5.4); added the
   automation "Fire an event" trigger (see 5.5), not originally scoped but a natural
   extension of "generalize trigger paths."
4. **Sidebar panel v1** *(done)*: list/create/delete popups (naming-convention
   based, no metadata registry), create opens native dashboard editor directly
   (`?edit=1`). Also includes an unscoped delivery pivot (see 5.7): converted
   from a frontend-only HACS plugin to a companion integration
   (`custom_components/nativepop/`), self-registering the panel and
   auto-loading the trigger listeners with no manual YAML. Rename deferred
   to milestone 5, as originally scoped.
5. **Polish** *(done)*: rename support (title only, url_path stays fixed —
   see 5.2); dialog widened via `--ha-dialog-width-md`; close-on-outside-click
   verified already-default (`ha-dialog`'s `lightDismiss`, no code needed);
   loading state while config fetches (dialog opens immediately with a
   spinner, swaps in `hui-view` once the WS fetch resolves, shows an inline
   error instead of `alert()` on failure). Also restyled the Popup Manager
   panel to feel more native (unscoped, added at Mikkel's request): a real
   toolbar dispatching the same `hass-toggle-menu` event `ha-menu-button`
   uses, a bottom-right positioned "+ New popup" button (matching Settings >
   Dashboards' FAB placement — HA itself dropped the actual `ha-fab`
   component in 2026.5), and click-to-copy on each row's url_path/hash.

   Two rounds of live-testing feedback, two fixes, same underlying lesson —
   default to whatever the *exact* native reference file uses, rather than
   approximating with a simpler/older component from elsewhere in this
   codebase:
   - Row markup: the first pass (`ha-list`/`ha-list-item` with graphic/meta
     slots) shipped with broken action buttons — the `hasMeta`/slot contract
     of that legacy MWC-based component couldn't be confirmed without
     live-testing, and turned out wrong. Replaced with plain styled divs
     using only individually-verified pieces (`ha-icon`, `ha-icon-button`),
     which removes that whole class of risk going forward.
   - The create button: first styled as `<mwc-button raised>` with a manual
     `--mdc-theme-primary` override, which rendered but didn't look native.
     `ha-button` (what the real "Add dashboard" button uses) isn't a themed
     `mwc-button` — as of 2026.5 it wraps an entirely different design
     system (`@home-assistant/webawesome`), so `mwc-button`'s CSS variables
     never had any effect on it. Fixed by using bare `<ha-button size="l">`,
     matching the native usage exactly instead of a lookalike.
   - Create/rename still used a browser `prompt()` for the name input after
     both of the above fixes — visually the most glaring remaining
     non-native piece. Replaced with a real dialog built from the same
     components HA's own dashboard create/edit dialog uses
     (`dialog-lovelace-dashboard-detail.ts`): `ha-dialog` + a schema-driven
     `ha-form` (`schema: [{name: "title", required: true, selector: {text:
     {}}}]`) + `ha-dialog-footer` with Cancel/Create `ha-button`s in the
     `secondaryAction`/`primaryAction` slots. Delete stays a plain
     `confirm()` — a destructive-action confirmation reads differently from
     "the creation interface," and was out of scope for this pass.
   - The list itself: even after the row-markup fix above, it was still
     hand-rolled divs, not the real "Manage dashboards" list Mikkel kept
     pointing back to. Replaced with an actual `ha-data-table` (see 5.2,
     5.8) — which also directly delivered the requested search feature, and
     forced the project's build-step reversal since the table's icon/action
     columns need real Lit templates. First pass used the native page's
     overflow ("⋮") menu for row actions too; feedback was that three
     actions behind one menu wasn't wanted here, so it's three plain
     `ha-icon-button`s on the row instead — the one place this panel
     deliberately doesn't mirror the reference file's exact layout.
   - Per-popup dialog width (5.2/5.3): a free-text override, not the size-preset
     dropdown originally floated in milestone 6's backlog — Mikkel wanted the
     flexibility of an arbitrary px/% value over a fixed set of options.
   - Dialog component: switched both dialogs from `ha-dialog` to
     `ha-adaptive-dialog` (5.3) for real swipe-to-close on mobile — a genuine
     bottom-sheet with touch/drag handling, not a resized dialog. Directly
     improves the mobile-behavior risk row in §7, though real companion-app
     testing is still outstanding (see below).
   - Reshuffle: no default dialog title (was hardcoded "NativePop"), create
     narrowed to name-only, and "Rename" grew into a single "Popup settings"
     action (5.2) covering rename + header/subheader/width/custom-CSS —
     Mikkel's call that all of these are "how a popup presents itself," not
     creation-time decisions, and belong together rather than split across
     create and a plain rename.

   Mobile-specific behavior (companion app testing) still outstanding — no
   way to verify without a physical device.
6. **(Optional v2)**: metadata registry/backend helper if naming convention proves
   limiting; preview mode in sidebar panel.

## 9. Open questions for implementation

- ~~Trigger element shape: standalone card, or a generic action usable from any card's
  `tap_action` without adding a wrapper card?~~ **Resolved (milestone 3)**: no wrapper
  card. `tap_action: navigate` to a `#popup-<slug>` hash is the primary mechanism
  (visual-editor friendly); `fire-dom-event` works too but is YAML-only since HA
  removed it from the visual action picker, so it's a fallback, not the primary path.
- ~~Should popup dashboards default to `type: sections` (native grid) or leave that as
  a user choice at creation time?~~ **Resolved (milestone 4)**: defaults to `sections`,
  set via a `lovelace/config/save` call right after `lovelace/dashboards/create` (which
  has no view-type field of its own). No creation-time override in v1.
- ~~Where does the global hash listener live so it's always loaded (a small always-on
  Lovelace resource vs. bundled into the sidebar panel's module)?~~ **Resolved (milestone
  4, superseding an earlier same-milestone answer)**: neither — the companion
  integration's `add_extra_js_url()` (see 5.7) auto-loads the module on every frontend
  page load, not scoped to Lovelace dashboards at all. This is a stronger guarantee than
  "loaded as a Lovelace resource" ever was, and was the deciding factor in adopting the
  integration-based delivery model.
- Minimum supported HA core version (affects whether `hui-view` mount patterns from
  older reverse-engineering write-ups still apply).

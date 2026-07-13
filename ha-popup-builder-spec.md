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
  navigation/hash-based trigger (deep-linkable, back-button aware).
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

A custom panel (`panel_custom` or a registered HA panel) providing:

- List of all popup dashboards (filtered by URL path prefix or a config registry —
  see 5.5).
- Create new popup (prompts for name → creates hidden dashboard, opens it in edit mode).
- Rename / delete popup.
- Copy popup slug/hash and example trigger YAML to clipboard (for both trigger styles).
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

### 5.4 Trigger paths (both call into 5.3)

- **Direct trigger**: `tap_action` → `fire-dom-event` with the target popup slug as
  payload. Existing cards get this added without being replaced.
- **Navigation trigger**: a global `hashchange`/`popstate` listener (registered once,
  e.g. from the sidebar panel's module or a lightweight always-loaded resource) watches
  for the `#popup-<slug>` pattern. On match, opens the dialog via 5.3; on hash removal
  (back button, manual navigation away), closes it. `tap_action: navigate` with
  `navigation_path: "#popup-<slug>"` becomes a valid way to open a popup from any card,
  matching Bubble Card's `hash:` behavior.

### 5.5 Registry / metadata

Need a lightweight way to track "which dashboards are popups" beyond just URL prefix
matching, to support renaming, filtering the sidebar list cleanly, and future metadata
(e.g. default dialog size, close behavior). Options to evaluate:

- Store metadata as a JSON blob in a dedicated `.storage` file via a small backend
  helper (if a companion integration/add-on is in scope), **or**
- Piggyback on dashboard `title`/`url_path` naming convention only, avoiding any
  custom backend (simpler, v1-friendly, but less flexible).

**Decision needed before implementation starts** — recommend starting with the
naming-convention-only approach (no backend component) and only introducing a
storage helper if metadata needs grow.

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
| Dialog sizing/responsiveness of a full view in a modal | Sections view assumes a full-page context | May need CSS overrides; test on mobile companion app and desktop |
| Hash trigger conflicts | Other cards/integrations may also use URL hashes (e.g. anchor links, other custom cards) | Namespace the hash pattern clearly (`#popup-...`) to avoid collisions |
| Hidden dashboards showing up unexpectedly (search, quick-bar, voice) | `show_in_sidebar: false` hides nav but may not hide from all HA surfaces | Verify behavior across HA search/quick-bar; document known limitations |
| Storage dashboard count at scale | Many popups = many dashboards in `.storage/lovelace.*` | Acceptable for personal use scale; not a concern at Mikkel's scope |
| Companion app (iOS) parity | Custom elements/dialogs, and hash-based navigation, sometimes behave differently in the app's webview | Test explicitly on iOS companion app, not just desktop browser |

## 8. Milestones

1. **Proof of concept**: manually create a hidden dashboard, write a static trigger
   that hardcodes fetching that one dashboard's config and mounts `hui-view` in
   a dialog via direct trigger only. Validate the core idea before building tooling.
2. **Navigation trigger**: add the `hashchange`/`popstate` listener and wire it into
   the same dialog mount from step 1. Validate deep-link + back-button behavior.
3. **Trigger element v1**: generalize both trigger paths into reusable, configurable
   mechanisms (slug-driven, not hardcoded).
4. **Sidebar panel v1**: list/create/delete popups (naming-convention based, no
   backend), create opens native dashboard editor directly.
5. **Polish**: rename support, dialog sizing/mobile behavior, close-on-outside-click,
   loading state while config fetches.
6. **(Optional v2)**: metadata registry/backend helper if naming convention proves
   limiting; preview mode in sidebar panel; per-popup dialog size presets.

## 9. Open questions for implementation

- Trigger element shape: standalone card, or a generic action usable from any card's
  `tap_action` without adding a wrapper card? (Latter is closer to the original
  `popup-card` UX and preferred if feasible.)
- Should popup dashboards default to `type: sections` (native grid) or leave that as
  a user choice at creation time?
- Where does the global hash listener live so it's always loaded (a small always-on
  Lovelace resource vs. bundled into the sidebar panel's module)?
- Minimum supported HA core version (affects whether `hui-view` mount patterns from
  older reverse-engineering write-ups still apply).

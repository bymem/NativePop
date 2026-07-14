# NativePop

Native Home Assistant popups — build popup content with HA's real dashboard
editor, trigger via tap or navigation, reusable across dashboards.

See [ha-popup-builder-spec.md](ha-popup-builder-spec.md) for the full technical
spec and milestone plan.

## Development

This repo now has a small build step — `src/nativepop.js` is the real
source; `custom_components/nativepop/www/nativepop.js` (what HACS/HA
actually serve) is a **build artifact**, bundled via esbuild, and must be
committed alongside any source change:

```bash
npm install     # first time only
npm run build   # after any change to src/nativepop.js
```

The build step exists specifically because `ha-data-table`'s column
templates need `lit-html`'s `html` tag (see the panel's source comments) —
everything else in this project stays plain, dependency-free JS. A GitHub
Actions workflow (`.github/workflows/verify-build.yml`) fails CI if `src/`
changes without a matching rebuild, so a stale build artifact can't silently
slip through a PR.

## Popup dialog CSS variables

Each popup's **Settings** (⚙ icon in Popup Manager) has a free-text "Custom
CSS variables" box — one `--variable: value;` per line, applied to **both**
the popup's dialog (`ha-adaptive-dialog`/`ha-dialog`, for dialog-chrome
variables) and its `hui-view` content element (for content-level variables
like the gutter ones below — see the note on why that split matters):

| Variable | Default | Effect | Applies to |
|---|---|---|---|
| `--ha-dialog-max-height` | `calc(var(--safe-height) - var(--ha-space-20))` | Caps the dialog's height | dialog |
| `--ha-dialog-min-height` | *(none)* | Forces a minimum height | dialog |
| `--ha-dialog-border-radius` | `var(--ha-border-radius-3xl)` | Corner rounding | dialog |
| `--ha-dialog-surface-background` | `var(--card-background-color, --ha-color-surface-default)` | Dialog background | dialog |
| `--dialog-content-padding` | `0 var(--ha-space-6) var(--ha-space-6) var(--ha-space-6)` (untouched — the dialog's normal chrome, same as any other HA dialog) | Padding around the dialog's `.body` content area | dialog |
| `--dialog-surface-margin-top` | `auto` | Vertical position within the viewport | dialog |
| `--ha-dialog-header-title-color` | `var(--primary-text-color)` | Header title text color | dialog |
| `--ha-dialog-header-title-font-size` | `var(--ha-font-size-2xl)` | Header title text size | dialog |
| `--ha-dialog-header-title-font-weight` | `var(--ha-font-weight-normal)` | Header title text weight | dialog |
| `--ha-dialog-header-title-line-height` | `var(--ha-line-height-condensed)` | Header title line height | dialog |
| `--ha-view-sections-column-gap` | **`0`** (`hui-sections-view`'s own default: 32px, ≥600px width) | Feeds `hui-sections-view`'s `.wrapper` div's horizontal padding | view |
| `--ha-view-sections-narrow-column-gap` | **`0`** (`hui-sections-view`'s own default: 8px, <600px width) | Same, <600px width | view |

**Don't set `--ha-dialog-width-*` here** — desktop width already has its own
dedicated "Dialog width" field in the same settings dialog (applied to
`--ha-dialog-width-md` specifically); a line for it in the CSS box would be
applied afterward and silently win over that field instead of erroring.

Header/subheader text itself isn't a CSS variable — set those via the
"Popup header"/"Popup subheader" fields in the same settings dialog.

**Why "applies to" matters**: the two `--ha-view-sections-*` variables above
(which zero `hui-sections-view`'s nested grid gutter — this is what
previously made popup content look inset from the dialog edge) only work
when set on `hui-view` itself, not on the outer dialog. `hui-view` has no
shadow root of its own and `hui-sections-view` is its direct light-DOM
child, so setting them there crosses no shadow boundary at all — whereas
several shadow-DOM layers sit between the outer dialog and `hui-sections-view`
(`ha-adaptive-dialog`'s internal desktop/mobile split). The dialog-chrome
variables above don't have this problem since they're consumed by
`ha-dialog` itself, which *is* the element they're set on.

Getting the exact variable names right took a fair bit of live
troubleshooting — `hui-sections-view`'s `:host` rule redefines
`--column-gap` and `--narrow-column-gap` *itself*, sourcing them from
`--ha-view-sections-column-gap` / `--ha-view-sections-narrow-column-gap`
respectively (confirmed by reading its actual adopted stylesheet live in
DevTools, not from GitHub source, which turned out to not match what was
actually running). Setting `--column-gap`/`--narrow-column-gap` directly, or
setting the right two variables on the wrong element (the outer dialog
instead of `hui-view`), both silently do nothing.

## Status: Milestone 5 (polish)

All trigger paths are slug-driven and usable without any NativePop-specific
wrapper card:

- **Navigation trigger (primary)**: navigating to `#popup-<slug>` opens the
  popup — via a real `tap_action: navigate` with
  `navigation_path: "#popup-<slug>"` (fully visual-editor friendly, works
  from tile cards, navbar cards, etc.), a plain link, the browser back
  button, or a cold-load deep link. Also handles real `tap_action: navigate`
  correctly, which internally uses `history.pushState()` and doesn't fire
  `hashchange`/`popstate` on its own — HA fires its own `location-changed`
  event for this, which we listen for too.
- **Direct trigger (fallback)**: any card's tap_action can open a popup with
  `action: fire-dom-event` and a `nativepop_popup: popup-<slug>` key. Works,
  but HA removed `fire-dom-event` from the visual action picker a while back
  (YAML-only), so `navigate` is the recommended tap trigger in practice —
  this is kept as a working fallback, not the primary path.
- **Automation trigger (no tap involved)**: any automation can open a popup
  with HA's built-in, visually-editable "Fire an event" action:
  ```yaml
  actions:
    - event: nativepop_open_popup
      event_data:
        popup: popup-security
  ```
  Broadcasts to every connected frontend session — no per-browser/per-user
  targeting in v1 (documented limitation, see spec risk table).

The `nativepop-poc-card` from earlier milestones still works (now with a
configurable `popup:` key) as a quick test harness, but it's no longer the
recommended way to trigger a popup — see the native-card tests below.

**Sidebar panel** ("Popup Manager", `nativepop-panel`) lists, creates, and
deletes popups — no more manually creating dashboards through Settings.
Naming-convention based (any dashboard with a `popup-*` url_path counts, no
metadata storage yet). Create only asks for a name — derives the url_path by
slugifying it, creates the hidden dashboard, defaults its view to
`type: sections`, and opens it straight into edit mode (`?edit=1`).
Everything else about how a popup presents itself lives behind the row's ⚙
**Settings** icon (previously "Rename"): rename (title only — the url_path
stays fixed, since every trigger is wired to it), a "Popup header"/"Popup
subheader" shown at the top of the dialog when it opens (blank by default —
no more hardcoded "NativePop" title), the per-popup dialog width from
before, and a free-text custom-CSS-variables box (see "Popup dialog CSS
variables" below).

**This milestone's polish**:
- The trigger dialog now opens immediately with a loading spinner instead of
  a silent delay, then swaps in the real popup content once it's fetched (or
  shows an inline error if the fetch fails, instead of a jarring `alert()`).
- The dialog is now noticeably wider (`min(90vw, 1024px)`) instead of
  mwc-dialog's cramped default.
- Removed `hui-sections-view`'s own nested grid gutter, which was stacking
  on top of the dialog's own normal content padding (`--dialog-content-padding`,
  left alone on purpose) and making popup content double-inset from the
  dialog's edge. Took several rounds to actually land — both the *which
  element* question (`hui-view`, not the outer dialog several shadow-DOM
  boundaries further out) and the *which variable* question
  (`--ha-view-sections-column-gap`/`--ha-view-sections-narrow-column-gap`,
  not `--column-gap`/`--narrow-column-gap` directly, both of which
  `hui-sections-view` redefines on its own `:host`) needed to be right
  together. Settled by reading `hui-sections-view`'s actual adopted
  stylesheet live in DevTools instead of trusting GitHub source further.
  See "Popup dialog CSS variables" above.
- Close-on-outside-click turned out to already work by default (`ha-dialog`'s
  own behavior) — verified, no code needed.
- The Popup Manager panel's list went through a few revisions before landing
  here: `ha-list`/`ha-list-item` (row actions never rendered), then plain
  styled divs (worked, but not the real thing), then a real `ha-data-table`
  with an overflow ("⋮") menu (matching the native page exactly) — but three
  actions behind a menu was more clicks than wanted, so the menu's gone: all
  three (Rename/Edit/Delete) now render as plain icon buttons directly on
  each row. Still a real `ha-data-table` for everything else: sortable
  "Name" column (url_path as secondary text, click-to-copy), a built-in
  search box (appears automatically once a column is `filterable` — no
  custom search code needed), full width, and clickable rows (opens edit
  mode). This table is also why the project now has a build step — see
  "Development" above.
- **Per-popup dialog width**: the create/rename dialog now has a second,
  optional field — free text (not a size dropdown), so either a px or %
  value works (e.g. `800px`, `70%`). Saved into the popup's own dashboard
  config, no new metadata store needed. Applies only on desktop — narrow/
  mobile screens always get the full-width dialog regardless of this
  setting (the field's helper text says so). Leave it blank for the
  existing default (`min(90vw, 1024px)`).
- **Both dialogs now swipe-to-close on mobile.** Switched from plain
  `ha-dialog` to `ha-adaptive-dialog` (added in HA 2026.3): a real desktop
  dialog above ~870px/500px, and a real swipeable bottom sheet below that —
  genuine drag-to-dismiss, not a resized dialog. Desktop mode still
  literally renders a nested `ha-dialog` internally, so the per-popup width
  override above keeps working unchanged.
- "+ New popup" moved out of the toolbar to a fixed bottom-right button,
  matching where Settings > Dashboards puts its "Add dashboard" action (a
  FAB in the native page). HA itself removed the dedicated `ha-fab` component
  in 2026.5, so ours is positioned with our own CSS rather than the actual
  FAB machinery (which only works inside `hass-tabs-subpage`, a much bigger
  component we deliberately aren't using). It's now `<ha-button size="l">`
  (not `mwc-button`, which is what the first pass used and didn't look
  native — turns out `ha-button` isn't a styled `mwc-button`, it wraps HA's
  newer webawesome-based design system as of 2026.5, with its own theming
  that `mwc-button`'s CSS variables don't touch). Matches the native "Add
  dashboard" button's usage exactly: no variant/appearance override, just
  `size="l"`.
- Each popup row's `#url_path` text is now click-to-copy (with a native-style
  toast confirmation via the same `hass-notification` event HA's own toasts
  use). Falls back to the older `execCommand("copy")` technique if
  `navigator.clipboard` isn't available — which it won't be over plain HTTP,
  e.g. a local HA instance without TLS, since that API requires a secure
  context.
- Create and rename no longer use a browser `prompt()` — they now open a real
  dialog built from the exact same pieces HA's own "create/edit dashboard"
  dialog uses (`ha-dialog` + a schema-driven `ha-form` + `ha-dialog-footer`
  with Cancel/Create `ha-button`s), instead of an approximation.

**Delivery model changed this milestone.** NativePop is no longer a
frontend-only HACS "plugin" — it's now a small companion integration
(`custom_components/nativepop/`), following the same pattern as
[ha-meal-planer](https://github.com/bymem/ha-meal-planer). This removes two
rough edges from the old setup: the manual `panel_custom` YAML entry, and an
unverified assumption about when a Lovelace resource is actually loaded.
Concretely:

- HACS category is now **Integration**, not Dashboard.
- Setup is "Add Integration" → confirm (no fields) — no YAML editing at all.
- The sidebar panel self-registers via Python
  (`panel_custom.async_register_panel()`).
- The trigger listeners (`NativePop.js`, now
  `custom_components/nativepop/www/nativepop.js`) auto-load on **every**
  frontend page via `add_extra_js_url()` — not scoped to Lovelace dashboards,
  which is a stronger guarantee than the old Lovelace-resource approach.

None of the actual trigger/dialog-mount logic changed — this is purely a
packaging and registration upgrade.

### If you have milestone 1-4 installed the old way, migrate first

You'll have a HACS "Dashboard" category install plus a manual `panel_custom`
YAML entry from testing earlier milestones. Clean those up before installing
the integration, since both would otherwise conflict with the new setup
(duplicate panel registration, duplicate `customElements.define` calls from
two different files):

1. Remove the `panel_custom:` block you added to `configuration.yaml` for
   milestone 4 testing.
2. **Settings > Dashboards > Resources**: remove the `NativePop.js` resource
   entry HACS added automatically.
3. In HACS, remove the old NativePop custom repository (Dashboard category).
4. Continue with the install steps below.

Your existing popup dashboards (e.g. `popup-test`) aren't affected — they're
just HA storage dashboards, untouched by any of this.

### Try it locally via HACS (custom repository)

1. In HA: **HACS > ... menu > Custom repositories**, add this repo's URL with
   category **Integration**.
2. Install "NativePop" through HACS.
3. **Settings > Devices & services > Add Integration**, search "NativePop",
   confirm the single (field-free) setup step.
4. Restart HA if the sidebar entry or trigger listeners don't seem to be
   live yet (should generally not be needed, but it's a new integration in
   this HA instance's first run).
5. Confirm **"Popup Manager"** now appears in the sidebar automatically — no
   YAML involved.
6. If you don't already have one, create a test popup via the panel (or
   reuse `popup-test` from earlier milestones) — see the panel test steps
   below.
7. Add the test harness card to any dashboard:
   `type: custom:nativepop-poc-card` (optionally with `popup: popup-<slug>`
   if you didn't use `popup-test`).
8. Tap "Open popup (direct)" and "Open popup (navigate hash)".
9. **Validate the no-wrapper-card mechanism** — add two plain native
   **Button** cards (via the real card picker, not YAML-only if you'd
   rather) with:

   ```yaml
   type: button
   name: Open popup (direct)
   tap_action:
     action: fire-dom-event
     nativepop_popup: popup-test
   ```

   ```yaml
   type: button
   name: Open popup (navigate)
   tap_action:
     action: navigate
     navigation_path: "#popup-test"
   ```

   Both should open the popup exactly like the PoC card's buttons, with no
   NativePop-specific card involved.
10. Back-button check: open via either navigation method, then hit the
    browser **back** button instead of closing — dialog should close and the
    hash should disappear.
11. **Automation trigger** — easiest test is **Developer Tools > Actions**:
    pick "Fire an event", set Event Type to `nativepop_open_popup` and Event
    Data to `popup: popup-test`, then perform the action — the popup should
    open with no card or tap involved.
12. **Popup Manager panel** (now a real `ha-data-table`, full width, same as
    Settings > Dashboards):
    - Existing popups should show up as rows: leading icon, title with
      `#url_path` underneath as secondary text, and three icon buttons
      (Settings/Edit/Delete) directly on the row — no overflow menu.
    - A **search box** should appear above the list automatically (no setup
      needed) — type part of a popup's name or url_path and confirm it
      filters the rows live.
    - Clicking the "Name" column header should sort the list; clicking it
      again should reverse the sort.
    - Click the `#url_path` secondary text — should copy it and show a toast
      ("Copied ... to clipboard") **without** also opening edit mode (they're
      stacked, but stopPropagation keeps them independent — worth confirming
      both still work on their own). If your HA is plain HTTP, this exercises
      the execCommand fallback rather than the Clipboard API — worth actually
      pasting it somewhere to confirm it copied, not just that the toast
      showed.
    - Clicking anywhere else on a row should open that dashboard in edit
      mode — check clicking one of the three action icons does *not* also
      trigger this (stopPropagation should keep them independent).
    - Pencil icon opens edit mode (same as row click). Cog icon opens the
      **Popup settings** dialog (see step 16). Delete icon asks for
      confirmation, then removes it and refreshes the list.
    - "+ New popup" (bottom-right) should render as a filled, pill-shaped
      button in your theme's accent color, matching Settings > Dashboards'
      "Add dashboard" button. Its dialog should now ask **only** for a name —
      no width field anymore (that moved to Settings).
    - On a narrow window (or the companion app), check the hamburger icon in
      the panel's toolbar actually opens the sidebar, and that all three row
      icons stay usable (not clipped/overlapping) at narrow widths.
13. **Dialog polish** — open any popup and confirm: it opens noticeably
    wider than before; briefly shows a spinner before content appears (may be
    too fast to see on a fast connection/LAN, that's fine); and clicking
    outside the dialog (on the dimmed background) closes it.
14. **Per-popup dialog width** — open a popup's ⚙ Settings dialog, set width
    to e.g. `500px`, save, then re-open the popup on desktop: it should be
    noticeably narrower than the default. Try `70%` too. Then check on a
    narrow window (or the companion app/phone) — it should be full width
    regardless of the saved value. Clear the field back to blank and confirm
    it returns to the normal default width.
15. **Swipe-to-close (mobile/narrow only)** — on a phone, the companion app,
    or a narrow-enough browser window, open a popup and drag it down from
    the top — it should follow your finger and close on release, the same
    as HA's own native mobile dialogs. Try it on the create and settings
    dialogs too. On desktop, confirm both dialogs still look and behave like
    normal dialogs (this only changes the mobile/narrow presentation).
16. **Popup settings — header/subheader/CSS variables**:
    - Open any popup without having set anything yet — the dialog should
      have **no title at all** in its header, just the close button.
    - Open ⚙ Settings, set "Popup header" to e.g. "Laundry" and "Popup
      subheader" to "Washing machine", save, then re-open the popup — both
      should now appear at the top of the dialog. Clear both back to blank
      and confirm the header goes back to empty.
    - In the same Settings dialog, paste something like
      `--ha-dialog-border-radius: 4px;` into "Custom CSS variables", save,
      and confirm the popup's corners actually change shape when reopened.
      Clear it and confirm it reverts.
    - Confirm the "Custom CSS variables" field's helper text points at this
      README's "Popup dialog CSS variables" section.

# NativePop

Native Home Assistant popups — build popup content with HA's real dashboard
editor, trigger via tap or navigation, reusable across dashboards.

See [ha-popup-builder-spec.md](ha-popup-builder-spec.md) for the full technical
spec and milestone plan.

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

**Sidebar panel** ("Popup Manager", `nativepop-panel`) lists, creates,
renames, and deletes popups — no more manually creating dashboards through
Settings. Naming-convention based (any dashboard with a `popup-*` url_path
counts, no metadata storage yet). Create prompts for a name, derives the
url_path by slugifying it, creates the hidden dashboard, defaults its view to
`type: sections`, and opens it straight into edit mode (`?edit=1`). Rename
only changes the display title — the url_path stays fixed on purpose, since
every trigger (hash, fire-dom-event, automation) is wired to it.

**This milestone's polish**:
- The trigger dialog now opens immediately with a loading spinner instead of
  a silent delay, then swaps in the real popup content once it's fetched (or
  shows an inline error if the fetch fails, instead of a jarring `alert()`).
- The dialog is now noticeably wider (`min(90vw, 1024px)`) instead of
  mwc-dialog's cramped default.
- Close-on-outside-click turned out to already work by default (`ha-dialog`'s
  own behavior) — verified, no code needed.
- The Popup Manager panel got a visual pass, revised once already: the first
  attempt used `ha-list`/`ha-list-item` (matching Settings > Dashboards'
  general shape) but the row action buttons never rendered — that component's
  `hasMeta`/slot contract couldn't be confirmed without live-testing. Rows are
  now plain styled divs using only two individually-verified pieces
  (`ha-icon`, `ha-icon-button`), which removes that whole class of risk. Still
  themed with real HA CSS variables (divider color, secondary text color,
  primary color).
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
12. **Popup Manager panel**:
    - Existing popups should show up in the list, each with a leading icon,
      the title, and `#<url_path>` as secondary text — and, importantly this
      time, three action icons (rename/edit/delete) visible on the right.
    - Click the `#<url_path>` text — should copy it and show a toast
      ("Copied ... to clipboard"). If your HA is plain HTTP, this exercises
      the execCommand fallback rather than the Clipboard API — worth
      confirming it actually copies (paste it somewhere) rather than just
      showing the toast.
    - "+ New popup" (now bottom-right) should render as a filled, pill-shaped
      button in your theme's accent color, matching Settings > Dashboards'
      "Add dashboard" button. Enter a name, confirm it creates a hidden
      dashboard, defaults its view to `type: sections`, and drops you
      straight into edit mode.
    - Pencil icon ("Edit") on any row should open that dashboard in edit mode.
    - Rename icon on any row should prompt for a new name and update the
      title in place (url_path/hash stays the same — check an existing
      trigger still works afterward).
    - Trash icon ("Delete") should remove it (with a confirmation prompt) and
      refresh the list.
    - On a narrow window (or the companion app), check the hamburger icon in
      the panel's toolbar actually opens the sidebar.
13. **Dialog polish** — open any popup and confirm: it opens noticeably
    wider than before; briefly shows a spinner before content appears (may be
    too fast to see on a fast connection/LAN, that's fine); and clicking
    outside the dialog (on the dimmed background) closes it.

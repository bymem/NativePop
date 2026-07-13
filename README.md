# NativePop

Native Home Assistant popups — build popup content with HA's real dashboard
editor, trigger via tap or navigation, reusable across dashboards.

See [ha-popup-builder-spec.md](ha-popup-builder-spec.md) for the full technical
spec and milestone plan.

## Status: Milestone 3 (generalized, slug-driven triggers)

Dashboards are still created manually (no sidebar panel yet — that's
milestone 4), but all trigger paths are now slug-driven and usable without
any NativePop-specific wrapper card:

- **Navigation trigger (primary)**: navigating to `#popup-<slug>` opens the
  popup — via a real `tap_action: navigate` with
  `navigation_path: "#popup-<slug>"` (fully visual-editor friendly, works
  from tile cards, navbar cards, etc.), a plain link, the browser back
  button, or a cold-load deep link. Also handles real `tap_action: navigate`
  correctly now, which internally uses `history.pushState()` and doesn't
  fire `hashchange`/`popstate` on its own — HA fires its own
  `location-changed` event for this, which we now listen for too.
- **Direct trigger (fallback)**: any card's tap_action can open a popup with
  `action: fire-dom-event` and a `nativepop_popup: popup-<slug>` key. Works,
  but HA removed `fire-dom-event` from the visual action picker a while back
  (YAML-only), so `navigate` is the recommended tap trigger in practice —
  this is kept as a working fallback, not the primary path.
- **Automation trigger (new, no tap involved)**: any automation can open a
  popup with HA's built-in, visually-editable "Fire an event" action — no
  backend integration needed:
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

### Try it locally via HACS (custom repository)

1. In HA: **HACS > ... menu > Custom repositories**, add this repo's URL with
   category **Dashboard**.
2. Install "NativePop" through HACS. It will add `NativePop.js` as a Lovelace
   resource automatically.
3. In HA: **Settings > Dashboards > Add dashboard**, uncheck "Show in
   sidebar", set a URL path (e.g. `popup-test`), add a couple of cards to its
   single view.
4. Add the test harness card to any dashboard:
   `type: custom:nativepop-poc-card` (optionally with `popup: popup-<slug>`
   if you didn't use `popup-test`).
5. Tap "Open popup (direct)" and "Open popup (navigate hash)" — same
   behavior as before, just slug-driven now instead of hardcoded.
6. **Validate the no-wrapper-card mechanism** — add two plain native
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
7. Back-button check: open via either navigation method, then hit the
   browser **back** button instead of closing — dialog should close and the
   hash should disappear.
8. **Automation trigger** — easiest test is **Developer Tools > Actions**:
   pick "Fire an event", set Event Type to `nativepop_open_popup` and Event
   Data to `popup: popup-test`, then perform the action — the popup should
   open with no card or tap involved. (Or add it as an automation action the
   same way, using the visual "Fire an event" action.)

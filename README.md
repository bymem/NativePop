# NativePop

Native Home Assistant popups — build popup content with HA's real dashboard
editor, trigger via tap or navigation, reusable across dashboards.

See [ha-popup-builder-spec.md](ha-popup-builder-spec.md) for the full technical
spec and milestone plan.

## Status: Milestone 3 (generalized, slug-driven triggers)

Dashboards are still created manually (no sidebar panel yet — that's
milestone 4), but both trigger paths are now slug-driven and usable without
any NativePop-specific wrapper card:

- **Direct trigger**: any card's tap_action (native or custom) can open a
  popup with `action: fire-dom-event` and a `nativepop_popup: popup-<slug>`
  key. Works because HA's own `fire-dom-event` action dispatches a
  `ll-custom` DOM event that bubbles up through shadow DOM — no wrapper card
  required.
- **Navigation trigger**: navigating to `#popup-<slug>` opens the same
  dialog — via a real `tap_action: navigate` with
  `navigation_path: "#popup-<slug>"`, a plain link, the browser back button,
  or a cold-load deep link. This also now correctly handles real
  `tap_action: navigate`, which internally uses `history.pushState()` and
  doesn't fire `hashchange`/`popstate` on its own — HA fires its own
  `location-changed` event for this, which we now listen for too.

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

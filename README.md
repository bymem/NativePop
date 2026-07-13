# NativePop

Native Home Assistant popups — build popup content with HA's real dashboard
editor, trigger via tap or navigation, reusable across dashboards.

See [ha-popup-builder-spec.md](ha-popup-builder-spec.md) for the full technical
spec and milestone plan.

## Status: Milestone 2 (navigation trigger)

Still targets one hardcoded, manually-created hidden dashboard. Validates two
things:

- **Milestone 1**: a direct-trigger button that fetches the popup dashboard's
  config and mounts it inside a dialog via HA's internal `hui-view` element.
- **Milestone 2**: the same dialog mount can also be opened by navigating to
  `#popup-test` — via a button that sets `location.hash`, the browser back
  button, or loading a URL that already has the hash in it (deep link). A
  global `hashchange`/`popstate` listener drives this, independent of
  whether the PoC card is even on screen.

No sidebar panel or generalized/slug-driven trigger element yet — those are
later milestones.

### Try it locally via HACS (custom repository)

1. In HA: **HACS > ... menu > Custom repositories**, add this repo's URL with
   category **Dashboard**.
2. Install "NativePop" through HACS. It will add `NativePop.js` as a Lovelace
   resource automatically.
3. In HA: **Settings > Dashboards > Add dashboard**, uncheck "Show in
   sidebar", set a URL path (e.g. `popup-test`), add a couple of cards to its
   single view.
4. If your url_path isn't `popup-test`, edit the `POPUP_URL_PATH` constant at
   the top of `NativePop.js` to match, then reload resources.
5. Add a card to any dashboard: `type: custom:nativepop-poc-card`.
6. Tap "Open popup (direct)" — the popup dashboard's view should render
   inside a dialog (milestone 1).
7. Tap "Open popup (navigate hash)" — same dialog, but the URL now shows
   `#popup-test`. Close it and check the URL reverts; open it again and hit
   the browser **back** button instead of closing — the dialog should close
   and the hash disappear (milestone 2).
8. Try loading the page with `#popup-test` already in the URL (paste it into
   the address bar and hit enter) — the dialog should open on its own once
   `hass` is ready.

# NativePop

Native Home Assistant popups — build popup content with HA's real dashboard
editor, trigger via tap or navigation, reusable across dashboards.

See [ha-popup-builder-spec.md](ha-popup-builder-spec.md) for the full technical
spec and milestone plan.

## Status: Milestone 1 (proof of concept)

Currently just validates the core idea: a hardcoded direct-trigger card that
fetches one manually-created hidden dashboard's config and mounts it inside a
dialog via HA's internal `hui-view` element. No navigation trigger, no
sidebar panel, no generalized trigger element yet — those are later
milestones.

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
6. Tap the card's "Open popup" button — the popup dashboard's view should
   render inside a dialog.

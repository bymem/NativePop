"""Registers the NativePop sidebar panel and auto-loads its trigger listeners.

Both live in this integration's own package (custom_components/nativepop/www/)
and are served via a static path registered by this integration — not HACS's
/hacsfiles/, which only serves files for "plugin" category repos, not
"integration" ones (see const.py for the full explanation).
"""
from __future__ import annotations

from pathlib import Path

from homeassistant.components import panel_custom
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.frontend import async_remove_panel as _async_remove_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import PANEL_MODULE_URL, PANEL_STATIC_URL_PATH, PANEL_URL_PATH

_WWW_DIR = Path(__file__).parent / "www"


async def async_register_static_path(hass: HomeAssistant) -> None:
    """Serve custom_components/nativepop/www/ at PANEL_STATIC_URL_PATH.

    Call once per HA process (from async_setup) — like the trigger-listener
    auto-load registration, static path routes cannot be unregistered, so
    registering this again on every config entry setup would raise on reload.
    """
    await hass.http.async_register_static_paths(
        [StaticPathConfig(PANEL_STATIC_URL_PATH, str(_WWW_DIR), True)]
    )


def async_register_trigger_listeners(hass: HomeAssistant) -> None:
    """Auto-load nativepop.js on every frontend page.

    This is what makes the navigate/hash, fire-dom-event, and automation
    triggers work everywhere, not just on dashboards that happen to have a
    NativePop resource added manually — call once per HA process (from
    async_setup); calling this twice would load (and customElements.define)
    the module twice.
    """
    add_extra_js_url(hass, PANEL_MODULE_URL)


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the /nativepop "Popup Manager" sidebar panel."""
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="nativepop-panel",
        frontend_url_path=PANEL_URL_PATH,
        module_url=PANEL_MODULE_URL,
        sidebar_title="Popup Manager",
        sidebar_icon="mdi:window-restore",
        require_admin=False,
    )


def async_remove_panel(hass: HomeAssistant) -> None:
    """Remove the /nativepop sidebar panel on unload."""
    _async_remove_panel(hass, PANEL_URL_PATH)

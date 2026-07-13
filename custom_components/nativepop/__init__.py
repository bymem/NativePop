"""The NativePop integration.

Registers the trigger listeners (navigate/hash, fire-dom-event, automation
"Fire an event") and the "Popup Manager" sidebar panel. See
ha-popup-builder-spec.md for the full design.

The static path and the trigger listeners' auto-load are set up in
async_setup (called exactly once per HA process, regardless of how many
times the config entry is reloaded) because neither can be cleanly
unregistered — doing so again on every config entry setup would raise or
double-register on reload. The panel, which does support clean teardown, is
scoped to the config entry instead.
"""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from . import frontend


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the nativepop domain: static path + global trigger listeners.

    Runs once per HA process, before any config entry is set up.
    """
    await frontend.async_register_static_path(hass)
    frontend.async_register_trigger_listeners(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up NativePop from a config entry: the sidebar panel."""
    await frontend.async_register_panel(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a NativePop config entry: the sidebar panel.

    The static path and trigger listeners stay registered for the life of
    the HA process — see the async_setup docstring for why.
    """
    frontend.async_remove_panel(hass)
    return True

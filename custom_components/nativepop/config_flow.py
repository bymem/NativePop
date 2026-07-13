"""Config flow for NativePop.

There is nothing to configure — no API keys, no options — so setup is a
single confirm step. Only one Popup Manager panel makes sense per HA
instance, so a second install attempt is blocked.
"""
from __future__ import annotations

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN


class NativePopConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the (config-free) NativePop setup flow."""

    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None) -> FlowResult:
        """Single confirm step — no fields to fill in."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            return self.async_create_entry(title="NativePop", data={})

        return self.async_show_form(step_id="user")

"""Constants for the NativePop integration."""

DOMAIN = "nativepop"

# Frontend panel + auto-loaded trigger listeners
#
# HACS's "integration" category only copies custom_components/ into the HA
# config dir — it does not manage a top-level www/community/ folder (that
# convention is for "plugin"/Lovelace-card category repos). So the frontend
# module ships inside the integration package itself, and we serve it via
# our own static path rather than relying on HACS's /hacsfiles/.
PANEL_URL_PATH = "nativepop"
PANEL_STATIC_URL_PATH = "/nativepop_files"
PANEL_MODULE_URL = f"{PANEL_STATIC_URL_PATH}/nativepop.js"

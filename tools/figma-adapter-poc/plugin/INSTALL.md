# II studio — editable Figma import

1. Extract the downloaded ZIP into a permanent folder on your Mac.
2. Open Figma Desktop and the design file you want to edit.
3. Choose Plugins → Development → Import plugin from manifest.
4. Select `manifest.json` from the extracted folder. In the Mac file picker, press Command–Shift–G to enter a folder path if needed.
5. Run “II studio” from Plugins → Development.
6. In II studio, open a completed Interface and click Copy for Figma.
7. Focus “Paste design on canvas” in the plugin and press Command–V. It validates and imports automatically; no separate Import click is needed.

No developer tools, API key, bridge, server connection, or account link is required by the plugin. Keep the plugin files and third-party notices together. The plugin has no network access. Figma itself still follows its normal file/account behavior.

The locally loaded development plugin requires Figma Desktop. Figma Web does not expose the local development-plugin installation workflow. Community publication is not included.

Native text, frames, simple Auto Layout, forms, tables, SVG charts/icons and conservative repeated KPI instances are supported within the adapter’s coverage. Interactions become editable design layers, not working application logic. Close dialogs/popovers first. Images, embedded media, complex gradients, some native controls and internally scrolling panels need Export PNG instead; the app reports unsupported cases before copying. Inspect any import notes.

For another import, paste a newly copied design. “Import again” intentionally creates another editable screen. The plugin does not replace or sync existing designs.

## Updated plugin

If an older development plugin is already registered, import this release copy's manifest.json in Figma Desktop and rerun the plugin. The new paste card contains a focused native text field; click the card and press Command–V. No clipboard-read permission is requested. File import accepts II studio design JSON, not workspace backup JSON. The .iistudio bundle format is not supported.

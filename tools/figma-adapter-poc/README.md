# Experimental Figma Adapter

Copy a supported completed interface from II studio, paste with Command-V into the separate development plugin, and import supported editable layers. The plugin has no network access and does not require a bridge or model key.

See [installation](plugin/INSTALL.md), the root README and SECURITY.md. Source is in src/. Build with npm run figma:build from the repository root; public/downloads/ contains the packaged plugin. Fixtures and tests use synthetic documents. Generated evidence/importer.js is a verification build artifact, not application data.

The adapter is not a universal HTML converter and does not transfer web interaction logic or synchronize edits. Some user-reported failures remain unreproduced in this release preparation; do not advertise it as stable. PNG export is the visual fallback.

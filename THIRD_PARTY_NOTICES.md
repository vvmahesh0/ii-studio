# Third-party notices

Apache-2.0 applies to original II studio contributions, not a relicensing of upstream work. Preserve this file, NOTICE, LICENSE and notices beside adapted files when redistributing.

| Work | Role / license metadata | Retained notice or source |
|---|---|---|
| OpenUI / Open Intelligent UI, Thesys | Parser, renderer and adapted component definitions; MIT | app/lib/openui/modern/UPSTREAM-LICENSE.txt; https://github.com/thesysdev/openui |
| shadcn/ui | Adapted Modern components and curated blocks; MIT | app/lib/openui/modern/SHADCN-LICENSE.txt; https://github.com/shadcn-ui/ui |
| Figma plugin typings | Development declarations; upstream license retained | tools/figma-adapter-poc/vendor/LICENSE and README.md |
| ELK.js 0.12.0 | Bundled layout worker; EPL-2.0 OR GPL-3.0-or-later metadata, distributed using EPL terms | public/vendor/ELK-LICENSE.md; source: https://github.com/kieler/elkjs/tree/0.12.0 |
| Next.js, React, React Flow, Radix, Zod and other npm packages | Runtime/build dependencies; individual licenses remain applicable | package-lock.json; installed package notices; docs/DEPENDENCY-LICENSES.json |
| lightningcss | Build dependency; MPL-2.0 | Installed package license/source notices |
| caniuse-lite | Browser-support data; CC-BY-4.0 | Installed package license/source notices |
| sharp / libvips | Next.js native dependency; libvips LGPL-3.0-or-later metadata | Installed sharp-libvips notices and https://github.com/libvips/libvips |

ELK is copied unchanged by scripts/prepare-flow-assets.mjs. Its source remains available from the upstream version above. Do not remove its license or imply that the bundled worker is original Apache code. Packaging native dependencies/binaries requires preserving their own notices and source/relinking obligations as applicable; this release is source-first, not a macOS binary distribution.

The installed-package inventory is machine/platform-specific and includes build dependencies. It is not a legal opinion or a guarantee that every transitive asset is covered. No proprietary font files are distributed: Avenir Next is a system font preference. The CLIs and models are installed/accessed by users separately, not redistributed here.

The Figma plugin UI embeds Lucide icon SVGs. Its downloadable ZIP includes the full Lucide ISC and applicable Feather MIT notices in THIRD_PARTY_NOTICES.txt.

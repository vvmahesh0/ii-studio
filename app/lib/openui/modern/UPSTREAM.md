# Modern source attribution

OpenUI adapters adapted from thesysdev/openui, revision 78844d2d065e8ed3ea335d5e089c1e21fbd502e8, examples/design-systems/shadcn/src/lib/shadcn-genui. See UPSTREAM-LICENSE.txt (MIT). Base primitives were installed using shadcn CLI 4.22.0, Radix/new-york, in components/modern/ui.

Local adaptations: Page and generic screen layouts, nestable cards, TableColumn naming, flexible child slots, rich table cells, immediate input state, scoped theme/portals, quiet actions, local pagination and state restoration. Remote images and chat follow-up components are excluded. Model inference uses the existing Antigravity/Gemini adapter; no Thesys gateway or new API key is used.

## Curated blocks

Adapted from the official @shadcn registry, fetched with shadcn CLI on 2026-10-17: sidebar-07 (contained application navigation), dashboard-01 (section cards and flexible dashboard content), login-01 and signup-01 (centered authentication surfaces). MIT license is retained in SHADCN-LICENSE.txt. Source-content checksums are recorded in docs/verification/blocks-source-manifest.json.

ContainedSidebar is a selected adaptation of shadcn sidebar's group/menu/button structure; it deliberately omits viewport-fixed positioning, provider cookies, global shortcuts, mobile sheets, tooltip portals and unrelated menus. Existing Button, Avatar and Card primitives are reused. Metric data, navigation, brand, fields and child slots are configurable. No original Next routes, hardcoded sample data, OAuth links, extra table engine, drag-and-drop engine or Tabler dependency are copied into the runtime. All blocks inherit the Modern palette and Avenir Next.

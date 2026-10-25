# Source attribution

The sibling component files are adapted from https://github.com/thesysdev/open-intelligent-ui, commit `6a4a0ba192ea285b3a5ed39dcc1295d7d4080d6f`.

Layout, text, controls, charts, tables, icon helpers, and local interactive extras are registered by this prototype. Remote media, HTML frames, maps, and external data tools are excluded. Local changes: scope theme defaults to the studio's light-theme boundary; rename layout.tsx to layout-components.tsx to avoid the Next.js route convention; name hook-using view functions; compute pie-slice angles without mutable render closures. The upstream snapshot does not include a license file; confirm distribution terms before publishing these vendored source files. The installed OpenUI framework packages declare MIT licenses.

The local `icon-component.tsx` registers the existing Glyph helper as a decorative Icon so metric cards do not need interactive buttons for decoration.

Local extras: Carousel, Popover, Code, Quote, Math (bundled KaTeX), Flashcard, Celebration, Markdown, Link, Pressable and Timer. Code is displayed as text, never executed. Celebration respects reduced motion; KaTeX keeps trust disabled and bounds expansion. Link opens an external website only when clicked. No YouTube/media-search module was imported.

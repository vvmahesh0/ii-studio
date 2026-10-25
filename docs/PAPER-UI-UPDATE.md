# Paper UI update — 24 October 2026

Implemented in the local-only release copy; original prototype, hosted demo and user workspaces are unchanged. Targeted source snapshot is stored outside the release. No deployment or publication.

## Changes
- app/studio/connection-settings.tsx and studio.css: reference-based pill, modal header/body/footer and provider/model controls.
- app/studio/image-actions.tsx, figma-actions.tsx, page.tsx: consolidated Export menu; clipboard writes still originate synchronously in user selection. Capture state and feedback stay mounted after the menu closes.
- app/workspace/workspace.css: centered backup row and space below divider.
- tools/figma-adapter-poc/plugin/ui.html: redesigned plugin, real textarea for native paste, input fallback, bounded file drop, preserved report and duplicate protection. Plugin opens at 440 × 540 content size.
- app/api/local/connection/route.ts: effective configured model is returned for accurate pill display; malformed non-object bodies rejected. No provider/model discovery inference call.

## Paste diagnosis
The earlier paste target was a button. A document paste listener alone is not a reliable native paste recipient in an embedded plugin when focus is not editable. The card now overlays a real focused textarea, consumes text/plain from the native paste event, and imports once without requesting clipboard-read access. A text-input fallback handles hosts that insert pasted text without dispatching the expected event. This addresses an observed implementation weakness; the actual user's failure is not yet proven resolved in Figma.

## Verification
135 automated tests, TypeScript, lint and production build passed. Runtime visual comparison and real Figma paste remain blocked by disconnected browser/Figma bridges; see ../design-qa.md. Existing model generation contracts and renderers are unchanged. The plugin source ZIP has been rebuilt with third-party icon notices.

## Continue testing
Open the running local preview at http://127.0.0.1:3012. Verify the pill/modal, generate or restore a completed interface, open Export and exercise the PNG/Figma actions, fullscreen, Clear and persistence. In Figma Desktop load this release's tools/figma-adapter-poc/plugin/manifest.json, then test actual Copy for Figma → focus paste card → Command–V. Verify editable text/layers and a repeated import, invalid input recovery and JSON file import. Do not substitute a harness import for this check.

## Connection retry
Figma Desktop Bridge now connects to the disposable test file. The updated app at port 3012 was visually observed after reload. Browser-extension transport and native manifest confirmation still block the full interaction and paste checks; see design-qa.md.

## Completed live checks
The updated white plugin auto-imported the generated Modern summary card as 40 editable layers. Invalid plain text was rejected and a subsequent valid native paste succeeded. Browser and Mac clipboards were isolated by automation, so the copied payload was relayed through the native clipboard bridge. Normal PNG copy/export and persistence restoration passed. Fullscreen dropdown portal was repaired; pending clipboard writes are bounded with download fallback. See design-qa.md for exact evidence and limitations. Final checks: 136 tests, lint, TypeScript, production build passed.

## Neutral paste card and white artboards
The paste card now inherits the import card's neutral 1 px border, without the blue outer glow. Keyboard focus has a neutral indicator inside the paste zone. After creating an imported root frame, the importer assigns it an opaque white solid fill. Child fills, layout and dimensions are unchanged. This applies to new clipboard and JSON imports; existing canvas frames are not modified.

Plugin rebuilt, TypeScript and scoped importer lint passed. Native Figma automation did not reliably reload the active plugin during this change, so the final neutral-border/white-fill result was not rechecked live. Close and rerun the updated development plugin before verifying a fresh import.

## Paused backup and design-file controls
Only the user-specified controls are hidden: the app's Export backup / Import backup footer (including its divider), the related deletion-dialog backup hint, and the plugin's entire Import design file card (including its report button). Workspace portability remains implemented behind SHOW_WORKSPACE_BACKUPS=false in navigation.tsx. The plugin card uses the hidden attribute plus an explicit display:none rule; handlers remain available for future restoration. Its initial window height is reduced to 340 px. Native paste and the app's Copy PNG, Export PNG, Copy for Figma actions remain in place.

Verification: production build, TypeScript and scoped lint passed. Browser navigation no longer exposes backup actions; the preview Export menu still exposes all three retained actions. Saved projects/artifacts remain accessible. Evidence: sibling ui-verification/backup-controls-hidden.png. Plugin rebuilt and packaged; reload the updated development plugin to see its compact paste-only panel. The refreshed native plugin panel was not independently checked in this change.

## Compact plugin title and content sizing — 25 October 2026
The native plugin title is now “II studio” in both the manifest and showUI options. Removed the duplicate logo/name row inside the content. The plugin opens at 440 × 256 and observes its content height to resize between 224 and 640 px, growing for import feedback and shrinking after it clears. Longer content scrolls within the bounded window. Paste behavior, hidden file import, and white imported artboards are preserved. Installation instructions and downloadable plugin ZIP are updated.

Verification: plugin build, TypeScript and scoped lint passed. Figma automation failed with a native pipe startup error while checking the refreshed panel; live appearance and resize behavior are not confirmed in this change. Close and reopen the release plugin to load the updated files.

## Paste instructions and reset sizing
Changed the paste card heading to “Click here, then press ⌘V”; clicking anywhere on the card focuses its native paste field. Success feedback now says only “Imported successfully”, with import notes retained separately when relevant. Replaced body-based sizing with a natural-height content wrapper, explicit auto/min-height reset, and content resize/mutation observation. The window can shrink after “Paste another design” hides feedback instead of retaining the previous iframe height.

Plugin rebuild and TypeScript passed. Native Figma menu selection did not open the refreshed panel, so the success/reset resize cycle was not verified live. Reopen the updated II studio development plugin and check importing then Paste another design.

## Minimal preview toolbar and mode fade
Interface preview retains its grid icon and places Preview / Select to refine beside it on the left. Removed Interface preview and Active preview labels; Export, fullscreen and Clear remain right-aligned. Both studio wrappers use a 180 ms opacity reveal from 0.65 to 1 when shown, with reduced motion disabled. Existing mounted workspaces, hidden-mode handling and progressive generation remain intact; no timers or model calls were added.

Verification: production build, TypeScript and scoped page lint passed. In the local browser restored Recent orders widget, toggled Select to refine, switched to Flowchart and back, and confirmed the saved interface remained available and the compact toolbar rendered correctly. Screenshot: ../ui-verification/compact-preview-toolbar.png. Static screenshot confirms placement; animation duration/reduced-motion rules inspected in CSS, without a frame-rate benchmark.

## Smooth segmented controls
Added smooth-tabs.tsx, a shared native Web Animations sliding indicator for Theme, Preview interaction, and Studio mode. Inspired by Motion Smooth Tabs' public description; no paid example source copied and no dependency added. Indicator uses transform-only interpolation, updates after button selection/resize, and skips motion under reduced-motion preferences. A small label cache keeps Theme movement continuous when changing theme resets the interface session. Studio content enters with a 220 ms directional slide/fade; both workspaces stay mounted, no delayed generation or output buffering.

Verification: TypeScript, scoped lint and production build passed. Browser checked Modern selection and Flowchart/Interface switching; settled styling captured in ../ui-verification/smooth-studio-tabs.png. No model calls or latency benchmark were performed for this animation-only change. Preview/refinement uses the same indicator implementation; no new automated tests were run.

## Refinement controls, selection contrast and page crossfade
Project creation now uses a blue Create action and neutral outlined Cancel; renaming uses Save. Global, studio and drawer text selection use #0868ff with white text. Refinement composer adds the reference's selected chip, outlined parent/clear controls, scope badge and blue border. Studio mode switching uses the browser View Transition API with a 180/220 ms old/new page crossfade, flushSync for the mode update and no generation delay. Existing mounted workspaces are retained; unsupported browsers keep directional entry animation and reduced motion skips transitions.

Verification: production build, TypeScript and scoped lint passed. Browser transport closed during reload, so these latest visual changes and crossfade were not verified live.

# Copy and PNG export — October 18, 2026

## Delivered

Interface preview has Copy and Export PNG beside the existing fullscreen/Clear actions. Both themes are supported. Flowchart has Copy beside the unchanged PNG download action. Actions require a completed result and are disabled while generating/capturing. Feedback is accurate; failed clipboard writes offer PNG download instead. No export modal, extra model request, export theme, or dependency was added.

## Capture design

- Interface snapshots the live rendered DOM, including field values, selected options, checked controls, expanded content and current local UI state. It clones into an inert, offscreen surface. The live renderer is never remounted or restyled.
- The current preview width is retained. Vertical scroll regions expand for complete content. Wide tables can extend the image rather than being cropped. Horizontal carousels retain their current visible page.
- Fonts and images load before capture. Existing SVG charts/icons and CSS theme variables are retained. Existing `html-to-image` 1.11.11 is dynamically loaded; no extra dependency.
- Interface output normally uses 2x resolution. It is bounded at 16,384 px per axis and 24 million pixels. Resolution may reduce to 1x while keeping layout width; larger captures fail explicitly instead of silently shrinking/cropping.
- Flowchart uses the existing complete-diagram PNG function: same bounds, routes, labels, white background, padding, dimension limits, scaling, and filtering. Only delivery (clipboard versus download) is shared.
- PNG export uses Blob URLs and artifact-derived filenames. Flowchart's previous filename convention is preserved.
- Copy initiates `navigator.clipboard.write` directly in the click, with a promised PNG payload. “Copied” follows successful completion of both capture and clipboard write. The helper waits for capture cleanup even on permission failure.

## Portal and unsupported-content policy

Capture is limited to the generated preview. Studio dialogs, toolbar, prompt, history and notifications are never included. Preview-owned floating descendants can be localized in the clone. Modal generated dialogs make toolbar actions inaccessible: close them before capturing. Body-portaled Default popovers cannot be faithfully associated with the preview and produce an explicit close-popover message when detected. No unrelated body portal is swept into an image. Native select popup lists are browser UI and are not included; the selected value is.

Broken/loading images, protected canvases, embedded video/iframes, excessive DOM size and oversized output produce errors. Cross-origin imagery requires the source server to allow embedding; browsers cannot bypass its protection. Existing catalogs disallow arbitrary remote images. PNG is a static snapshot; it does not retain interactions or editable layers.

Image clipboard access varies by browser and requires a secure context (localhost qualifies). Use Export PNG if copying is blocked or unavailable. See [MDN Clipboard.write](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/write) and [html-to-image](https://github.com/bubkoo/html-to-image).

## Verification performed

- Production build, TypeScript and lint passed; 67 automated tests passed (including 8 new image-delivery/limits tests).
- Default pricing export: full three-card layout, fonts, colors and spacing; no studio chrome.
- Modern login export: actual edited email value retained (`capture-check@example.com`), correct typography, icons and theme.
- Modern chart + AppShell fixture: full SVG chart, labels, sidebar and metrics preserved.
- Tall deterministic fixture: 34 sections, 2,460 × 7,816 PNG, final “End of complete interface” visible. Oversized 170-section fixture rejected with a clear message.
- Fullscreen retains Copy/Export actions. Generated modal closes normally; its modal interaction prevents toolbar clicks while open.
- Flowchart Copy/Export exercised on a restored, manually edited branch diagram, with complete labels/arrows and no viewport controls. The same capture function is used for both. No claim of binary equality between separate captures.
- Real macOS clipboard verified in Chrome by opening the copied Modern form in Preview. The in-app automated browser reports successful writes but did not update the macOS pasteboard in this test harness; its virtual clipboard is not evidence of native paste success.
- Clipboard denied/unsupported, synchronous write failure, asynchronous capture failure, cleanup and user-activation ordering are covered by injected unit tests. Live browser permission settings were not altered.
- Persistent saved versions restored correctly after a production restart. Modern library restoration now proceeds independently of model preparation, so viewing/capturing saved content does not wait for Gemini.

Evidence: `docs/verification/copy-export/`. Capture fixtures are explicitly deterministic, not presented as AI-generated output. Broader generation/refinement checks and measured observations are recorded in `DESIGN-QUALITY-AUDIT.md`. The additional flip-card test found browser 3D backface duplication; the offscreen clone now includes only its currently visible face, and the corrected PNG was visually verified. Safari/Firefox clipboard interoperability and arbitrary third-party images have not been manually certified.

## Important files

- `app/lib/image/interface-capture.ts`: actual DOM capture and safeguards.
- `app/lib/image/png.ts`: sizing, clipboard and Blob download helpers.
- `app/studio/use-image-actions.ts`, `image-actions.tsx`: shared status/actions.
- `app/studio/page.tsx`, `studio.css`: Interface integration.
- `app/flowchart/editor.tsx`: existing diagram capture reused for Copy.
- `tests/image-export.test.mjs`: clipboard/dimension regressions.

## Try it

Open the local app, restore or generate a completed interface/diagram, and click Copy or Export PNG. Paste the image into a native image-capable application. To run locally: `npm run dev` in `prototype/` (stop an existing port-3000 process first). For a capture error, read the displayed limitation; Export PNG handles clipboard restrictions but cannot bypass an unsupported capture surface.

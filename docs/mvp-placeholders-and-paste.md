# Local image placeholders, longer prompts and simpler Figma paste

20 October 2026

## Changes

- Both Interface libraries register `ImagePlaceholder(label?, aspect?)`, with landscape, portrait, square, wide and avatar options. Muted backgrounds, a Lucide vector icon and optional contextual labels use each theme's tokens. No URL, browser image element, image provider, web search or additional model call. Small guidance in each existing model setup asks for these when photographs or illustrations are requested.
- Existing stored programs and library signatures remain compatible. The addition is backward compatible; library revision identifiers remain unchanged. Restarting the server prepares fresh model workers using the regenerated catalogs.
- The Interface and Flowchart composers now allow **20,000 characters**, including spaces. Server generation/refinement validation and persisted artifact/version instructions use the same shared limit. Existing component-ID limits and graph/node budgets are unchanged.
- Requests remain bounded at 600,000 encoded bytes, accommodating JSON-escaped long requirements alongside prior content. Increasing the maximum does not add work to short requests; actual longer requirements can take more time and model usage.
- Figma's existing native paste event now submits directly to the validated importer. Paste anywhere inside the plugin with **⌘V**. No clipboard read API or new clipboard permission is used. The JSON textarea and initial Import step are gone. A visible paste target explains the keyboard action; clicking it focuses it, rather than claiming to read the clipboard. Invalid payloads still fail before document mutation; the busy lock rejects repeated events during import. Deliberate “Import again” is available after success.
- The plugin ZIP and its installation instructions are rebuilt. Users of the existing local development plugin should close and rerun it; users with an extracted ZIP should replace its built files using the updated download.
- ChatGPT sign-in, OpenRouter, other API keys, hosted trials and macOS packaging remain deferred.

## Checks performed

- Production build, TypeScript and lint passed.
- Actual browser rendering inspected for Modern and Default using isolated fixtures; no saved user artifacts were modified by those fixtures.
- Both placeholder fixtures extracted successfully as DesignIR, with no extraction warnings. Example images are local frames/vectors/text rather than bitmap elements rejected by the adapter.
- Browser composer confirmed `maxlength=20000`; existing saved landing page restored after reload.
- The new automatic-paste path reuses the existing importer. A live native paste/import was not repeated in this change: Figma Desktop was on a new/empty file rather than the earlier disposable verification file. No claim of newly verified end-to-end native transport is made.
- No additional automated test suite was added or run for this change.

## Try it

1. Refresh II studio at http://127.0.0.1:3000/.
2. In either theme, request: “Create three hotel cards with photo placeholders, names, ratings and nightly prices.”
3. Copy for Figma, open the updated plugin, and press ⌘V. Import should begin without a second click. Invalid copied text shows an error.
4. Long requirements can now exceed the former 2,000-character limit and remain in saved artifact/version instructions. The maximum is 20,000 characters, not words. Do not silently shorten the original requirement.

Developer visual fixtures: http://127.0.0.1:3000/experiments/figma-adapter → Image placeholders · Modern / Default. These fixtures make no AI requests and do not write workspace history.

Evidence: `docs/verification/placeholders-20261020/modern.jpg`, `default.jpg`, and their extracted `.design.json` files.

Source/configuration backup: `../backups/pre-placeholders-prompt-paste-20261020/source.tar.gz`. Prior backups were preserved.

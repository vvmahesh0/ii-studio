# Targeted interface refinement

## Outcome

Implemented for Interface Studio, Default and Modern. Flowcharts are unchanged. The approved blue studio design, Avenir Next, component tokens, model transport and normal generation endpoint remain unchanged. No runtime dependency or model stage was added.

## How to use it

1. Open or generate an interface.
2. Choose **Select to refine** in the preview toolbar.
3. Click a meaningful component. Hover and selected outlines show its boundary. Use **Select parent** in the composer for a larger section.
4. Describe the change and choose **Refine selection**.
5. The existing interface remains visible. A safe replacement appears progressively when it passes validation. Completion creates a new version of the same artifact.

**Preview** restores normal interaction. **Clear selection** returns to Preview and whole-interface refinement. Escape clears selection and exits selection mode. In fullscreen, select normally; **Describe change** leaves fullscreen and focuses the existing composer. No second fullscreen or composer system was introduced.

Tables, charts, DataList and MetricCards are selected as whole registered components. A cell, chart path, or metric inside a compound block is not an independent selection. Individually registered cards, fields, buttons, sections, forms and layout containers can be selected separately.

## Source identity and bounded replacement

- Completed definitions are normalized locally: inline catalog calls receive deterministic declaration identities derived from their owning declaration and source call path. Streaming initial generation remains on the original path.
- Stable library adapters tag actual rendered roots. They do not add DOM layout wrappers or change component schemas. Local Form forwards those attributes through its existing provider/root.
- Selection maps those attributes back to real declarations and their dependency hierarchy, never DOM position or SVG internals.
- The new local `/api/openui/refine` endpoint receives the source program, target and instruction. It reuses the existing theme worker, local-origin safeguards, request limits, abort handling and shared generation lock.
- Gemini receives only the selected definition/dependencies and minimal parent type context. It returns a self-contained replacement fragment, not an entire new screen.
- The application rejects outside references, new reactive declarations, executable action/function expressions, duplicate IDs, cycles and detached definitions. It namespaces new dependencies, replaces only the selected declaration, and preserves every original declaration outside the selected private dependency closure.
- Old private descendants can be retired; dependencies shared with other parts of the screen remain unchanged. This prevents repeated refinement from accumulating unused definitions. Fifty repeated edits are covered by a bounded-size test.
- The complete merged result is checked by the existing theme catalog and Modern block validator. Compatibility comes from the actual parent contract. No new HTML, CSS, executable code or generated component types are accepted.
- Shared/reused selections or selections with shared reactive state fail safely with guidance to select a parent or use normal refinement. The application never silently widens scope.
- `OUT_OF_SCOPE` is a supported model refusal. There is at most one scoped correction; it does not use the normal whole-page correction instructions. Semantically unchanged output does not create a new history version.

## Rendering, interaction and persistence

The previous complete screen stays mounted while generation begins. At most once per 80ms, available fragments can be auto-closed for a provisional parse; only fully valid merged previews are displayed. The final result must validate without auto-closing. Invalid fragments never replace the saved version. Stop/failure restores the last completed version.

Normal controls work in Preview. Selection mode intercepts clicks, editing input, context menus and activation keys. Tab remains available; Enter/Space select a focused control rather than activating it. Editing is disabled during generation. Selection uses a single preview observer pair and event-driven animation-frame measurements, including scroll/resize/fullscreen; it does not attach an observer to every component.

Successful changes use existing immutable artifact versions and parent-version links. Interface generations now optionally include `{kind: "selection", targetId, component, parentId?}` metadata. This additive field needs no database migration and remains compatible with old records/backups. Selection is transient and reopening a saved artifact starts in Preview.

Existing renderer-store values are copied into the refined version. Actual checks retained form values, a different active tab and a list search. This is not a universal serializer for every component's private React state. Existing browser-reload limitations for transient control state remain.

Selection graphics are siblings of the capture surface, so Copy/Export exclude them. Existing capture/portal rules remain: floating panels may need closing before capture. Portaled popup internals and non-rendering schema helpers are not independent selectable units; select a containing section.

## Speed gate

A source/configuration snapshot was made first: `../backups/pre-targeted-refinement-20261018/source.tar.gz`. Existing v1 backups were untouched.

The experiment used the same warm authenticated Gemini model and fixed source screens. Global and targeted refinements alternated order over three repetitions per case. It did not add a preliminary planning or review call. Early trial results were mixed; a validator bug incorrectly classified an email address's `@` as executable syntax. That bug was fixed before the controlled comparison. Early trial files are retained as diagnostic evidence, not counted as final results.

### Production warm comparison

Eighteen requests: nine global, nine targeted. All succeeded, with zero corrections. Source checks confirmed unchanged outside declarations; requested title/label/task changes also preserved the other inspected selected-component content.

| Task | Global completion median | Targeted completion median | Global first parsable median | Targeted first parsable median |
| --- | ---: | ---: | ---: | ---: |
| Contact section heading | 3.69s | 2.71s | 3.60s | 2.71s |
| Submit button label | 2.97s | 2.75s | 2.92s | 2.65s |
| First task title | 4.07s | 3.26s | 3.05s | 2.51s |

Slowest production baseline: 14.39s. Slowest targeted: 3.96s. The earlier controlled trial had a targeted 7.80s outlier. Model variability remains; these observations do not promise faster results for every request.

First raw model output is not a visible UI measurement. For the button, raw targeted output began later on median (2.65s vs 2.13s), while its first parsable change and completion were earlier. Server first-parsable measurements above do not include browser paint. They are not a reason to hide progressive output.

Preparation was recorded separately: Modern 14.02s, Default 19.65s; additional warm-up generations 2.04s/2.84s. These times are excluded from warm comparison results, matching the already-connected use case.

Actual browser observations included a button refinement completing/painting around 2.60s, and a Default list showing useful changed content around 3.95s before completion around 4.95s. They are individual observations, not repeated browser benchmarks. The existing screen remained visible throughout.

Normal generation's endpoint, worker instructions/transport and both catalogs are byte-for-byte unchanged from the snapshot. Completed-source normalization plus selection indexing measured about 0.04–0.05ms median over 200 repetitions per sample (Node measurements, not browser paint). This does not establish identical performance for arbitrarily large interfaces.

The final source also adds private-dependency cleanup and semantic no-op detection after the production comparison. Those, meaningful-draft gating, and an expanded-fragment size safeguard are local validation changes with no additional model turn; final smoke tests exercise this source. No claim is made that those post-comparison checks were separately benchmarked through repeated browser runs.

## Verification

- Unit suite covers source scanning, stable inline identities, nested selection, aliases/property keys, namespace isolation, shared dependencies/ancestors, cycles, outside references, detached output, bounded correction/refusal, repeated-edit size and semantic comparisons.
- Persistence tests cover target metadata, immutable parents and reopening previous versions.
- Browser checks: Modern button and inline Input refinements; whole MetricCards and chart selection; unrelated tab preservation; Default DataList refinement/search preservation; cancellation retaining the current version; prior-version restoration; reload in Preview; fullscreen selection; PNG export without selection chrome; backup metadata export.
- Existing tests cover Interface contracts, forms/collections, block examples, PNG sizing/failure handling, workspace persistence and Flowchart contracts/layout/editor history.
- 86 automated tests, TypeScript, lint and the production build passed. A final production chart-card refinement completed/painted in 2.32s, preserved all inspected outside declarations, removed three obsolete private definitions, and saved v3 with v1 as its parent. Switching to Flowchart and back cleared selection while preserving a nonempty interface draft. Main-origin saved work reopened successfully without importing test fixtures there.

Evidence: `verification/targeted-refinement/production.json`, `summary.json`, `browser-workspace.json`, PNG screenshots and export sample. The benchmark utility is `scripts/benchmark-targeted-refinement.mjs`; analysis uses `node --experimental-strip-types scripts/analyze-targeted-refinement.mjs`.

## Known boundaries

- No Flowchart targeting, per-cell selection, per-item MetricCards selection, layer panel or design skill.
- Shared component occurrences and shared reactive expression scopes require selecting a safe parent or normal refinement. Runtime-store state is preserved where already supported, not universally across browser reloads.
- Model-generated changes inside the selected component still depend on instruction fidelity. Local enforcement guarantees the boundary and contract, not every aesthetic or wording interpretation.
- A component without a rendered/forwarding root, or floating popup internals, may require selecting its container. Current common layouts, blocks, buttons, fields, tables and charts have been checked.
- Replacement fragments are limited to 500 expanded component calls to prevent repeated-reference explosions. The existing 2,000-character prompt and 64KB prior-definition request limits remain. No fixed speed guarantee is possible with a remote model.

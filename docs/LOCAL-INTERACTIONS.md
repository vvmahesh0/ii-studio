# Local forms, tables and lists — October 18, 2026

## Implemented

Both Default and Modern can now generate working local collection controls. They use supplied sample data; typing, filtering, sorting, pagination and resetting do not contact Gemini or another server.

- **Forms:** local validation and reset, plus Enter-key validation in single-line inputs. A successful local check says “All fields look good.” It does not claim an email was sent, an account authenticated or data submitted to a backend. Modern supports a Form defaults object keyed by field name. Default uses its existing input values as defaults. Reset clears errors and restores those initial values. Modern checkbox groups can require a selection; Default text/email/password/URL inputs and textareas support the registered validation rules.
- **Tables:** opt-in built-in search, exact-value column filters, ascending/descending/original-order sorting, reset, filtered result counts and pagination. Filters operate on visible badge/text content too. Numeric amounts sort numerically. Search and filters combine, then sorting and pagination apply. Page position clamps after filtering.
- **Lists:** new shared `DataList` definition for plain-data items with stable IDs, titles, optional descriptions and statuses. Supports search, status filtering, title sorting, reset and pagination. The existing decorative `List` remains available for static feature lists and timelines.
- **Navigation:** automatic titles use local rules and at most five words. Existing long titles are compacted for display; saved requirements and existing records are not rewritten. New manual project/artifact/conversation names are bounded to five words. No naming model request.
- **UI:** informational dialogs use Close, including Flow details. Backup import/export are outlined buttons. Removed the drawer’s browser/Mac sentence and the Local workspace label. Save state appears at the right of the version-history footer in both modes.

A source snapshot was saved at `../backups/pre-local-interactions-20261018/source.tar.gz`. Existing v1 and earlier snapshots were left intact.

## Generation contract

One existing generation pass and correction limit remain. No new provider, planning pass, dependency, hosted service or general design skill was added. `package.json` and lockfile were verified unchanged.

The additive definitions preserve `default-v1` and `modern-v3` compatibility, so older saved definitions continue to validate. Existing static screens are not automatically rewritten to guess connections between independent inputs and tables. Generate/refine them to request the new built-in behavior.

Examples:

- Default: `Table(columns, rows, {search:true, filterBy:["Status"], sort:true, pageSize:5})`.
- Modern: `Table(columns, rows, 5, {search:true, filterBy:["Status"], sort:true})`.
- Both: `DataList([{id:"one",title:"Review request",description:"Check the details",status:"Open"}], {search:true,filterBy:["Status"],sort:true,pageSize:5})`.
- Modern Form optional fifth argument: `{name:"Maya",plan:"pro"}`. Button optional fifth behavior: `submit` or `reset`.
- Default Button optional ninth behavior: `submit` or `reset`. Input values set defaults; optional fifth Input/TextArea rules configure validation.

Descriptions and one concise library-specific instruction tell Gemini to use these controls rather than generating separate unconnected filters. Existing null-action Reset/Reset form/Reset values buttons also reset when inside a local form. Other unconnected backend actions remain unconnected.

## Speed check — retained after measurement

The same three requirements ran three times each before and after: nine baseline and nine updated requests. Same Gemini 3.8 Flash connection/settings, no extra model stage. Every run completed without an automatic correction. Raw programs and timings are in `verification/local-interactions/before.json` and `after.json`; exact prompts are included.

| Task | Median first parsable content before → after | Median completion before → after |
|---|---:|---:|
| Contact form | 4.10s → 4.00s | 4.15s → 4.06s |
| Support table | 5.45s → 3.46s | 7.36s → 4.92s |
| Task list | 7.98s → 4.11s | 10.40s → 5.48s |

No median slowdown was observed. Collection output became shorter because one configurable component supplies the controls. These are small-sample observations, not a guarantee or proof of universal speed improvement. Slow outliers occurred: 17.67s before and 21.38s after; the updated table also had a 19.17s run. Tail variability was not isolated, and no better worst-case latency is claimed.

Cold preparation was measured separately: approximately 13.08s for Modern and 13.52s for Default after restarting the server. Server “first content” measures parsability, not browser paint. A separate pure-data check on 1,000 rows took a median 0.17ms over 30 local Node runs; this is not a browser rendering benchmark.

## Verification

- Production build, TypeScript and lint passed; 73 tests passed, including collection composition, numeric sorting, empty results, pagination clamping, parser contracts, standalone DataList usefulness and title limits.
- Six deterministic fixtures cover forms/tables/lists in both libraries. They were imported through the app into the isolated localhost test workspace, without modifying the main 127.0.0.1 workspace.
- Modern: defaults populated name/plan; required email and agreement errors appeared; valid submission checked locally; Reset cleared errors and restored defaults.
- Default: required email/message errors, valid submission, reset and Enter-key validation verified. Field accessible names remain stable when errors appear.
- Modern/Default tables: search and status filtering worked; Modern numeric sorting, filtered result counts, reset and next-page behavior verified.
- Default list: title sorting and status filtering combined. Modern list: empty-result feedback and reset verified.
- Actual third-run model outputs were imported separately. The generated list search found the database task; generated table status filtering and customer sorting worked. PNG export preserved the current filtered table.
- Flow details has a Close button and still displays saved manually edited diagram content. Existing saved artifacts reopened; navigation/history and Copy/Export remain available.

Evidence: `verification/local-interactions/`, including screenshots, parser-checked fixtures, actual model outputs, a portable test workspace and measurement data.

## Limits and practical use

This adds local behavior over supplied data, not live customer records, authentication, backend saving, CSV export, calculators or arbitrary generated code. List sorting is by title; table sorting uses text/numeric order rather than an invented business-specific priority ranking. Existing widget state follows the renderer’s current state lifecycle; this task does not add durable storage of personal form entries.

Try:

1. “Create a support tickets table with search, status filters, sorting and pagination.”
2. “Create a project task list with descriptions, statuses, search and sorting.”
3. “Create a contact form with required name, email and message, plus Submit and Reset. Keep it local.”

Generate in either theme. Enter fields or search/filter the collection; verify rows change immediately without starting another generation. Use Reset to restore initial state. If an older screen still has disconnected filters, refine it with “Use the table’s built-in local controls.”

## Main files

`app/lib/openui/local/` contains shared local form state, collection operations, themed controls and DataList. Existing Default/Modern form and table adapters expose optional properties. `app/lib/workspace/model.ts`, `app/workspace/`, shared studio components and the flow editor contain the title/footer/navigation changes. `tests/local-interactions.test.mjs` and `scripts/benchmark-local-interactions.mjs` preserve verification and performance checks.

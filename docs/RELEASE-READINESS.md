## Model picker and motion update
Live Antigravity and Codex model enumeration is implemented through metadata-only CLI commands. The selected Codex default is pinned to an explicit model ID and displayed in the header. Short CSS transitions cover theme, refinement, and Export controls; reduced-motion preferences disable them. Production build, TypeScript, lint and live picker checks passed. No generation prompt or renderer changes, new dependencies, or model benchmark were introduced. See docs/MODEL-SELECTION.md.

## Paper update verification (latest)
New connection controls, Export dropdown, centered backups and white plugin panel checked live. Generated test interface auto-imported to Figma as 40 editable layers through native paste (automation clipboard relay required). 136 tests, lint, TypeScript and build passed. Fullscreen menu fixed; clipboard timeout has a PNG download fallback. See design-qa.md for scoped visual result and limitations. This supersedes earlier connection-blocked notes below.

> **Paper UI update:** Local changes are implemented; visual QA and real Figma paste verification remain blocked by disconnected browser/Figma bridges. See PAPER-UI-UPDATE.md and ../design-qa.md. Current automated total: 135 passing tests.

# Release readiness — 24 October 2026

## Status: local release candidate prepared; not approved for publication

Prepared for Mahesh V V (@vvmahesh0), Apache-2.0, Apple Silicon macOS only. No Git repository was initialized, no code uploaded, no release created and no live website changed. Original prototype, hosted demo, credentials and browser workspaces are untouched. The release copy excludes Vercel, Upstash, OpenRouter, owner keys, trial counters and app telemetry.

## Actual checks

- Original local-feature tests: 120 passed after removing demo-specific tests.
- Added CLI protocol/process and local-request checks: 9 passed; total **129 passed**, zero failures/skips.
- ESLint passed with no warnings; production build passed; TypeScript passed.
- The packaged source was extracted into a fresh temporary directory with no dependencies or private configuration. Setup/npm ci, all 129 tests, lint, production build and TypeScript checks passed there. This is a clean-directory check on the same Apple Silicon Mac, not proof on a second machine or all macOS versions. Host Node was 26.12.0; Node 24+ is declared but Node 24 itself was not separately exercised.
- npm audit reported zero known vulnerabilities after updating Zod to a patched 4.6.6-compatible version. This is a point-in-time advisory result, not a complete security guarantee.
- Setup was rerun successfully and preserved existing local configuration byte-for-byte.
- Local connection API rejected a foreign Origin (403), unsupported provider (400) and shell-like model input (400). Executable paths are accepted only from trusted environment configuration, never from the browser.
- Mocked subprocess tests cover text events, failures, malformed output, output bounds and cancellation. Actual requests exercised existing parser/validator/correction paths, not a replacement renderer.
- Original workspace/storage, Figma contract/importer, PNG helper and refinement-scope tests remain passing. New browser-based persistence, clipboard/fullscreen/export and targeted-refinement regressions could not be rerun because browser automation reported an unattached debugger. They are explicitly pending, not counted as passes.

## Live provider observations

Single synthetic runs through real generation API routes; timings are server-event arrival/completion, not first browser paint or statistical benchmarks.

| Provider | Check | First output | Completion | Outcome |
|---|---|---:|---:|---|
| Codex | Default interface after diagnostic-event fix | 13.1s | 15.0s | Valid completed result |
| Codex | Modern interface | 15.5s | 17.5s | Valid completed result |
| Codex | Interface refinement | 18.2s | 20.4s | Valid completed result |
| Codex | Flowchart | 16.2s | 18.2s | Valid completed result |
| Codex | Flowchart refinement | 11.1s | 13.5s | Valid completed result |
| Antigravity | Cold Default generation including worker preparation | 18.6s | 18.7s | Valid completed result |
| Antigravity | Cold Modern generation including worker preparation | 24.7s | 25.3s | Valid completed result |
| Antigravity | Warm interface refinement | 2.5s | 3.2s | Valid completed result |
| Antigravity | Cold Flowchart profile including worker preparation | 25.5s | 25.6s | Valid completed result |
| Antigravity | Warm Flowchart refinement | 2.6s | 2.7s | Valid completed result |
| Claude | Modern interface | — | 2.9s | Failed; a minimal follow-up classified authentication failure despite auth status reporting signed in |
| Gemini CLI | Live generation | — | — | Not installed; adapter unverified |

See provider-checks.json for metadata. Initial Flowchart test-harness requests incorrectly supplied an empty-string previous diagram and were rejected before inference; those requests were fixed and rerun correctly. Do not interpret them as model failures. A Default Codex attempt initially rejected a nonfatal item-level diagnostic as a tool. A metadata-only probe identified the event, a focused regression test was added, and executable tool events remain rejected. The final API retry completed a valid Default interface in 15.0 seconds. No stronger speed claim or model-comparison ranking is made. Codex chunks completed agent messages; Antigravity retains its existing progressive stream. No extra model-planning call was added.

## Security and sensitive-data review

- Current app and project parent are not Git checkouts; there is no accessible commit history to scan. Any future imported remote history needs review before publication. No history was rewritten and no credential was rotated.
- .env.local, .vercel, backups, historical private-path logs and unrelated reference checkouts were deliberately excluded from the clean copy.
- Source pattern checks passed for credential-shaped strings and machine-specific paths, excluding dependencies/build output. The Figma ZIP's four entries were inspected for the same patterns. Two authentic historical screenshots were visually inspected and contain synthetic product examples.
- This is a scoped release-preparation review, not a formal exhaustive security scan. Blind spots include unknown credential formats, hidden image metadata, external history and third-party behavior. Re-run the check on the final staged file list before pushing.
- CLI output is bounded and never forwards raw diagnostics/credentials to the browser. Cancellation terminates process groups, with escalation; unexpected tools reject output. Provider restrictions vary by version and do not imply universal OS isolation. Read SECURITY.md.

## Dependency and ownership review

Installed named-package license metadata has no missing entries; most is MIT/ISC/Apache/BSD. EPL-covered ELK is copied unchanged with its license and upstream source reference. MPL, CC-BY and native libvips LGPL entries are identified separately in THIRD_PARTY_NOTICES.md. Keep their notices; do not relabel dependency code Apache. No proprietary fonts are bundled.

The owner confirmed personal-work ownership. This does not establish ownership of every upstream asset. A final notice/source-offer review, especially ELK and any future bundled native binaries, remains required before distribution. This release is source-first, not a native macOS application bundle.

## Remaining release gates

- [ ] Creator review of final source file list, attribution, screenshots and license/notices.
- [ ] Confirm official repository name/URL; currently only creator account is approved.
- [ ] Complete browser regressions for connection switching, saved restoration, PNG/copy/fullscreen and targeted refinement.
- [ ] Resolve Claude authentication and run both generation/refinement modes, or keep explicitly experimental/unverified.
- [ ] Install/authenticate/test Gemini CLI when available, or keep explicitly experimental/unverified.
- [x] Antigravity Default live generation passed; Default contract/local-interaction tests also pass.
- [ ] Reproduce the user's Figma failure; plugin remains experimental, not a release-quality guarantee.
- [ ] Review dependency/source-distribution obligations and final archive.
- [ ] Explicit permission before creating/uploading a GitHub repository, publishing v0.1.0 or replacing the public website.

## Suggested repository metadata (not applied)

Description: Generate interactive interfaces and editable workflows from requirements using your own AI CLI.

Topics: generative-ui, openui, react, nextjs, flowchart, react-flow, shadcn-ui, local-first, design-tools, human-ai-interaction.

Release notes: see CHANGELOG.md. No launch or adoption metrics are invented; app telemetry is absent. GitHub's native metrics can be used after publication. Scheduled analytics and website tracking have not been added.

## Rollback / next operation

This directory is a separate working release copy. Continue using the original prototype to return to the previous app; no production rollback is needed. Export a workspace backup before trying the release on an existing browser origin. Its temporary port 3012 has separate browser storage from port 3000.

## Publication — 25 October 2026

The owner subsequently authorized publication. Local application source is now public at https://github.com/vvmahesh0/ii-studio (Apache-2.0). Earlier “not approved/not uploaded” statements above are historical. This publication is source-only; no new native binary, signing, notarization or universal provider compatibility is claimed.

The source-pattern scan passed; 262 initially staged files and the bundled plugin ZIP contents were scanned for credential-shaped values with no findings. This is not a comprehensive security audit. Private configuration, dependency/build directories, workspace data and deployment metadata are excluded by Git ignore rules. Current build, TypeScript and scoped lint passed. Existing provider verification boundaries remain.

Both studios now include a LinkedIn author credit beside saved status. Static marketing site source lives in website/, with GitHub links and the same safe setup prompt as docs/SETUP-PROMPT.txt. Browser checked both empty-state footers and the website's Copied feedback. In-app-browser clipboard readback was empty despite the browser resolving writeText; native clipboard handoff was not independently proven by automation.

Public website deployment completed at https://iistudio.vercel.app/. The project was renamed and that domain registered as a production domain to retain anonymous public access without disabling preview authentication. Latest deployment: dpl_Dm4inr8U6ZSb2WNxEzuvKdYRwXNE. The short domain returned unauthenticated HTTP 200 and was opened in the browser. Author attribution was checked in both studios. No live model requests or new tests were run during publication; build, TypeScript, scoped lint, release-pattern scans and website script syntax check passed.

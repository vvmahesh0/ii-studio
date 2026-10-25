# Local model selection and control motion

## Model discovery

II studio fetches models only while the AI connection dialog is open. Antigravity uses `agy models`; Codex uses its local App Server `initialize` and `model/list` protocol over a private stdio process. No thread, generation turn, or model-based discovery call is created. Discovery is bounded to 25 seconds and 2 MB, filtered to safe model IDs, deduplicated, limited to 100 options, cached for 60 seconds (failures for only 3 seconds), and shared between concurrent callers. The temporary CLI process is stopped after discovery.

The endpoint is local-origin protected and accepts only the four registered CLI providers. It never returns authentication or configuration files. Models are the CLI-reported catalog, not a guarantee of account entitlement or compatibility with every generation task.

Selecting a listed model passes its exact ID through the existing `--model` transport. Choosing the Codex default resolves the CLI-reported default and saves that explicit ID, so the header displays a concrete model rather than an unidentified provider default. Existing CLI safety flags are unchanged. Current selection remains process-local as before.

Claude Code/Gemini CLI retain custom model entry with a clear explanation when automatic enumeration is not implemented. Failed discovery also retains that fallback. No static list of presumed available models is shown. Existing unspecified CLI defaults are labeled as unreported rather than guessed.

Reference: [official Codex App Server protocol](https://learn.chatgpt.com/docs/app-server).

## Motion

The Modern/Default and Preview/Select controls crossfade their active backgrounds over 180 ms. Export opens with a 180 ms fade/4 px translation, closes in 120 ms, and rotates its chevron. Motion uses CSS only, adds no dependencies or model calls, and does not delay generation or rendering. Reduced-motion preferences disable these transitions.

## Verification

Live model enumeration returned six Antigravity and six Codex entries on the development Mac. A cold metadata lookup observed about 7.6 seconds for Antigravity and 1.8 seconds for Codex; these are settings lookup timings, not generation latency measurements. Browser checks verified switching provider, selecting a discovered model, applying the Codex default as an explicit model, displaying GPT-6-Astra in the header, and reopening the selection. The original Antigravity connection was restored afterward.

TypeScript, production build and lint checked. Unit tests were not added or rerun for this request. Generation instructions, component catalogs and renderers are unchanged; no new model generation benchmark was performed.

Final reload also verified successful Antigravity enumeration while the library was preparing. An intermittent cold-start lookup hit the initial 12-second timeout; the bound is now 25 seconds and failed lookups expire after 3 seconds so they can be retried quickly. Screenshot: sibling ui-verification/model-picker.png.

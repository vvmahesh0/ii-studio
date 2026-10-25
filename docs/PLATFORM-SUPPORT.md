# Platform support

Updated: 25 October 2026

II studio's setup and runtime adapters target macOS arm64/x64 and native Windows 11 x64. Intel macOS and Windows are experimental until authenticated provider generation is verified on those systems. The app is not a native desktop binary; it runs locally through Node.js and a browser. The model does not have to run on the user's processor.

| Platform | Installation/build | Synthetic transport | Authenticated generation |
|---|---|---|---|
| Apple Silicon macOS | Local checks; compatibility CI | Local tests and CI | Antigravity and Codex have recorded live checks; see PROVIDERS.md |
| Intel macOS | Passed final-code CI on macos-15-intel | Passed synthetic fixtures and cancellation checks | Not yet verified; experimental |
| Windows 11 x64 | Passed CI on Windows Server 2025 x64, not a Windows 11 desktop | Passed native .cmd launcher, timeout and process-tree tests | Not yet verified; experimental |
| Linux / WSL / Windows ARM | Outside this release's setup targets | No support claim | No support claim |

See [PLATFORM-VERIFICATION.md](PLATFORM-VERIFICATION.md) and the repository's Platform compatibility workflow for actual runner results. A configured job is not a passed check. Windows Server CI is useful build/process evidence, not Windows 11 browser or AI-provider certification.

## Installation

Install a compatible Node.js 24+ release with npm, Git, a modern browser and your chosen supported official CLI. No WSL, Python, system zip, global npm tools or administrator privileges are required by II studio's setup. A provider's own installation may have additional requirements; do not bypass them.

From the repository root run `npm run setup`, choose provider settings in ignored `.env.local`, authenticate through that CLI, then run `npm run dev`. For production use `npm run build` then `npm start`. Use `npm start -- --port 3012` if the default port is busy. Servers bind to 127.0.0.1 only.

In Windows PowerShell, if execution policy blocks npm.ps1, use `npm.cmd run setup` and the equivalent npm.cmd commands; do not weaken execution policy. Quoted absolute provider paths can be configured in .env.local, e.g. `II_CODEX_PATH="C:\Program Files\Tools\codex.cmd"`. Supported Windows launchers are .exe, .cmd and .bat. PowerShell-only .ps1 launchers are not accepted; locate the provider's official native/npm launcher instead.

Discovery uses platform PATH/PATHEXT and optional explicit paths. On macOS those paths must be executable; on Windows they must be supported files. Empty or relative PATH entries are not searched. CLI prompts travel through stdin, not shell commands. Cancellation targets only the owned process tree.

Setup preserves existing environment configuration and lockfile. On macOS a new .env.local gets mode 0600. On Windows access follows your filesystem ACLs; setup does not claim POSIX permissions protect Windows files.

## Provider compatibility remains separate

- Antigravity's sandbox implementation and supported CLI flags are not guaranteed on every OS.
- Codex uses restrictive flags that must be supported by its installed version/platform.
- Claude Code and Gemini CLI remain experimental; cross-platform setup does not upgrade their live-verification status.
- Unsupported flags or missing provider prerequisites fail with guidance. Studio does not disable sandbox/tool restrictions, install WSL, or switch providers automatically.
- CLI detection is not proof of authentication, model entitlement, streaming granularity or sandbox availability.

No model accounts or credentials are installed by CI. A human must authorize live provider smoke checks on a new platform before its status is promoted. Those checks include Interface and Flowchart generation/refinement, Stop, temporary cleanup, saved history, fullscreen and PNG export.

Older docs may describe the original Apple-Silicon-only release; this document and the current README supersede that installation restriction. They do not supersede historical provider test results.

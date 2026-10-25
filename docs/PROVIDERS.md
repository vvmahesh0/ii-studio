# Local CLI compatibility

Connections run through official CLIs installed on the user's computer. Setup targets macOS arm64/x64 and native Windows 11 x64; Intel and Windows remain experimental. The actual live results below are from Apple Silicon macOS, not cross-platform certification. Cloud-backed subscriptions retain their own limits and terms. There is no OpenRouter, Thesys gateway, hosted trial or studio API key. No offline inference provider is currently implemented.

| Connection | Implementation | Actual verification in this release preparation |
|---|---|---|
| Antigravity `agy` | Existing sandboxed persistent workers; profile/model-specific warm setup | Real Modern interface generation and refinement passed. Flow checks recorded in RELEASE-READINESS.md. |
| Codex `codex` | Noninteractive JSON events, ephemeral session, read-only sandbox, shell feature disabled, user config/rules ignored and web search disabled | Installed CLI 0.155.1: real Default generation, Modern generation and refinement passed; flow checks recorded in RELEASE-READINESS.md. A nonfatal item-level diagnostic classification was corrected with a regression test. Emits complete agent-message chunks rather than guaranteed token streaming. |
| Claude Code `claude` | Print/stream-json, partial messages, empty tools list, hooks disabled, no session persistence, strict empty MCP config | Installed 2.1.158; live generation failed. Available as an experimental adapter, not verified support. Sign-in/model entitlement must be resolved before claiming compatibility. |
| Gemini CLI `gemini` | Separate headless JSONL adapter with sandbox and local deny-all-tool policy | Not installed on this test Mac; mocked transport only. Experimental/unverified. This is not the same executable/protocol as Antigravity. |

## Configuration

Edit .env.local using .env.example. II_CLI_PROVIDER chooses a provider; II_MODEL optionally chooses its compatible model. Empty means its default, except the existing Antigravity fallback remains gemini-3.8-flash-low (also overridable with legacy MOSAIC_GEMINI_MODEL). Each executable supports II_<PROVIDER>_PATH as an absolute path, otherwise ~/.local/bin and platform PATH are searched, with Windows PATHEXT for .exe/.cmd/.bat launchers. PowerShell-only launchers are rejected. The UI does not accept executable paths or shell commands.

Connection settings detect executables and choose a provider/model for the current server process. They do not log users in, enumerate subscription entitlements or guarantee model access. Changes are blocked while a generation is active. Environment defaults are read again after restart. Workspaces remain untouched.

A specific model must be authorized by its provider. No hardcoded live model catalog or paid/free routing policy is imposed by studio; selecting a model may consume subscription allowance or incur provider charges according to the CLI's existing authentication. Studio never switches providers silently.

## Known differences

Antigravity retains its prepared catalog context. Other adapters repeat the relevant manual for each request and create a fresh subprocess, so startup/context overhead and streaming behavior differ. Refinement still receives the selected current program/graph explicitly. No extra planning model call was added; validation may perform the existing one correction.

Tool restriction flags and event schemas vary by CLI version. Unsupported flags fail rather than downgrade permissions. Unexpected tool output rejects the result but is not itself an OS sandbox. Run only trusted CLIs, keep the server loopback-only, and read SECURITY.md. Claude/Gemini are experimental until live tests pass.

For new tools, add an explicit adapter and compatibility tests; do not run arbitrary user-supplied command templates.

See [PLATFORM-SUPPORT.md](PLATFORM-SUPPORT.md) for installation/build, synthetic transport and live-provider verification levels. Provider restrictions are never relaxed to make another OS work.

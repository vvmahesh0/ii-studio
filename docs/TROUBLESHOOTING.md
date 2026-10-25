# Troubleshooting

- **CLI not found:** install the official provider CLI, reopen Terminal, confirm its command resolves, or set an absolute II_<PROVIDER>_PATH in .env.local. Do not install an unrelated similarly named package.
- **Disconnected/authentication failure:** sign in through the CLI directly, check access to the selected model and restart/reconnect. Never copy account files into the repository.
- **Model unavailable:** clear II_MODEL to use the provider default or enter an authorized model ID. A subscription is not a universal API entitlement.
- **No progressive output:** some CLIs emit completed messages rather than token deltas. Output remains structured and is validated; smaller prompts may help. This is not a renderer speed guarantee.
- **Generation stops:** inspect the safe application error, check quota and try a smaller prompt. One structural correction may consume another provider request. Previous valid artifacts remain.
- **Invalid generated UI:** use a compatible capable model. The application validates against its catalog; unsupported functionality cannot be fixed solely by prompting.
- **Projects missing:** reopen the same browser/profile and exact localhost origin. Restore a workspace backup; do not delete IndexedDB as a troubleshooting first step.
- **Copy denied:** permit clipboard write or use Export PNG. Keep the page focused. Large captures and unsupported overlays may fail explicitly.
- **Figma import fails:** use a supported simple interface, close generated overlays, retry the experimental plugin and report a synthetic reproducer. Do not post customer designs or clipboard payloads publicly.
- **Install/build failure:** use Node 24+, npm ci, and the supplied lockfile. First installation requires internet. Do not run npm audit fix --force blindly.
- **Port occupied:** use the exact URL printed by Next, remembering a changed port has separate browser-local storage. To specify a port: npm run dev -- --port 3010.

Only Apple Silicon macOS is in the first-release scope. CLI versions vary; see PROVIDERS.md for actual checks and gaps.

## Intel Mac and Windows setup

The older Apple-Silicon-only scope above is historical. Current setup also accepts Intel macOS and native Windows 11 x64 experimentally; see PLATFORM-SUPPORT.md for actual checks. Windows PowerShell users can run npm.cmd rather than changing execution policy. Configure an absolute .exe/.cmd/.bat provider launcher if detection fails; .ps1-only launchers are not accepted. Provider sandbox requirements vary: do not remove restrictions or install WSL to work around a failure automatically.

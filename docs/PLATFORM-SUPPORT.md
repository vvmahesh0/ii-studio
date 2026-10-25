# Platform support

Updated: 25 October 2026

## Architecture versus current release support

II studio uses a browser UI, Next.js/Node.js server, React components and JavaScript diagram libraries. The product's core design does not inherently require an Apple Silicon processor. Cloud inference runs through the selected provider; it does not require the model to run on the user's processor.

That does **not** mean the published release currently works on any OS or architecture.

| Platform | Current status |
|---|---|
| Apple Silicon macOS | Verified release target, with provider-specific verification limits documented in PROVIDERS.md. |
| Intel macOS | Plausible porting target, but not verified; npm run setup currently rejects it. |
| Windows | Not supported by the current setup. Requires setup, shell-command and CLI process/launcher compatibility work, then live verification. |
| Linux | Plausible porting target, but not verified; npm run setup currently rejects it. Provider sandbox/installation behavior also needs review. |
| Other architectures | No claim of compatibility. Node.js, native build dependencies and the selected CLI must support the actual OS/architecture. |

## Concrete release limitations

- scripts/setup.mjs explicitly requires darwin/arm64 and exits elsewhere.
- package.json uses POSIX environment-variable assignment in development/build/start scripts, which does not work directly in Windows' default command shell.
- CLI discovery, launcher extensions, process-group termination and sandbox flags require platform-specific review. Windows-installed .cmd/.exe launchers and subprocess cancellation cannot be assumed equivalent to Unix executables.
- CLI availability and authenticated model access are separate from browser support.
- Avenir Next is a local macOS font choice with fallbacks, not a bundled font or processor requirement.

Do not simply remove the platform guard and call the port complete. Cross-platform support requires adapting these paths, preserving security restrictions, and checking real generation, refinement, cancellation, local storage and exports on each target. No Windows, Intel Mac or Linux runtime was available or verified during this documentation update.

No runtime behavior changed in this update. Existing Apple Silicon setup and provider support boundaries remain unchanged.

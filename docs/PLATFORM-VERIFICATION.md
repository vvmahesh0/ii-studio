# Platform compatibility verification — 25 October 2026

## Code and automated checks

Compatibility implementation: 62b0734; Windows fixture fixes and timeout coverage: d134653.

- Local Apple Silicon Mac: 142 tests, ESLint, TypeScript, production build, plugin packaging and loopback server check passed.
- Clean local clone: npm run setup, repeat setup preserving .env.local, build and 142 tests passed. The repeat-setup fixture is now CI-only so it cannot append synthetic markers to normal user configuration.
- First hosted run: https://github.com/vvmahesh0/ii-studio/actions/runs/40219320555 — Apple Silicon and Intel macOS passed. Windows installation/config preservation, lint, types and build passed, then tests exposed two fixture issues: missing filename extension and URL.pathname conversion of Windows drive paths. Fixed without skipping tests.
- Final-code hosted run: https://github.com/vvmahesh0/ii-studio/actions/runs/40219691552 — all three jobs passed (macos-15, macos-15-intel, windows-2025), each with 142 tests, lint, production build, TypeScript and loopback startup.
- Windows synthetic tests exercise real native .cmd launchers in paths with spaces, special-character arguments, stdin, transport errors/output bounds, timeout, cancellation and owned child-tree termination. Figma fixture entry paths use fileURLToPath.
- Local plugin ZIP contains only manifest.json, code.js, ui.html, INSTALL.md and THIRD_PARTY_NOTICES.txt, generated without a system zip executable.
- No hosted CI job uses provider credentials or calls an inference model.

CI runs macOS 15 arm64, macOS 15 Intel and Windows Server 2025 x64 on Node.js 24. Local checks ran on the existing Mac/Node environment. Server CI is not a Windows 11 desktop usability or authentication check.

## Live existing-provider regression on Apple Silicon

Selected existing authenticated Antigravity connection; synthetic content only:

1. Generated a compact Default contact form; it rendered and saved v1.
2. Refined its heading to “Contact our team”; fields/buttons remained and v2 saved.
3. Opened fullscreen, exported a PNG, received a download and “PNG exported” feedback, then exited fullscreen.
4. Generated a five-node Request handling flowchart; the canvas rendered and saved v1.
5. Renamed the review step to Check request; edges remained and v2 saved.
6. Started another refinement and pressed Stop; completed v2 returned without an extra completed version.
7. Reloaded the browser; flowchart v2 restored. Reopened the contact form from the drawer; interface v2 restored.

These are functional smoke checks, not a latency benchmark. No extra model stage was introduced. Existing model contracts, correction rules and streaming code paths remain in use.

## Remaining boundaries

Intel Mac and Windows authenticated provider generation is unverified and remains experimental. Windows 11 interactive browser/fullscreen/clipboard behavior was not checked on a physical Windows machine. Claude Code and Gemini CLI retain their earlier experimental status. A provider that lacks compatible sandbox flags must fail rather than silently disable restrictions.

Rollback: revert the platform-support commits together, including package.json/package-lock.json, process helpers, setup/launch scripts and build helper. Preserve .env.local and browser IndexedDB; no artifact migration is needed. Re-deploy the previous static website version if rolling back its copied prompt.

## Release and website

The canonical environment-aware prompt in docs/SETUP-PROMPT.txt matches website/public/setup-prompt.txt. Static website deployment dpl_DXDtWccwmf6vDbH2FCMPDPUVnAqA serves https://iistudio.vercel.app/. Only the marketing site is hosted. During publication a command was initially run from the wrong directory; the unintended app deployment and its empty Vercel project were removed, and project absence verified before continuing from website/. No hosted application is part of this release.

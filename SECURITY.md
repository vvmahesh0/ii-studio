# Security

II studio v0.1.0 is a local development application. Bind it to loopback using the provided commands. Do not expose it through a tunnel, public host, shared server or untrusted LAN. It does not provide authentication or multi-user isolation.

Generation requests send requirements and relevant design context to your selected CLI's provider. A local CLI usually uses cloud inference; this is not an offline model guarantee. The CLI handles authentication under its own terms and privacy settings. Studio does not read credential files. CLIs are privileged software: use trusted official installations. Sandbox/tool flags vary by version; do not assume a coding-agent sandbox is an OS-wide security boundary.

Studio accepts structured component definitions, not arbitrary generated HTML/JavaScript. Browser requests have local-origin checks and bounded inputs. CLI output is bounded, tools are restricted, and unexpected tool events reject the result. Existing Antigravity behavior is preserved, including its documented sandbox limitations. CLI failure never grants broader permissions automatically.

Projects live in IndexedDB for the browser/profile/origin. Backups and pasted Figma designs may contain user content. Review them before sharing. Browser cleanup may erase projects. Backup controls are currently hidden; do not treat browser-local storage as a cloud backup.

Do not report secrets or exploit payloads publicly. For a suspected vulnerability, contact the maintainer through GitHub's private vulnerability reporting if enabled; otherwise request a private contact channel without disclosing details in a public issue. No private channel or response deadline is currently guaranteed. Rotate exposed credentials through their provider; deleting a file alone does not erase Git history.

Release security review and known gaps are recorded in docs/RELEASE-READINESS.md. A successful dependency scan is not a complete security audit.

# Architecture

Browser React workspace → loopback Next.js API → selected local CLI → inference provider → structured stream → parser/validator → renderer → IndexedDB.

Interface rendering uses OpenUI Lang contracts and Default/Modern registries. There is one correction attempt at most, using the existing library validator. Flowcharts use a separate NDJSON graph contract, graph validation, React Flow editing and ELK worker layout. Models do not generate executable UI code or coordinates.

`app/lib/model/provider.ts` preserves the transport interface used by all three AI routes, including targeted refinement. Antigravity retains warm workers by catalog/model. Other CLI adapters use isolated subprocesses and repeat the appropriate compact catalog instructions for each turn. This is simpler but may have higher startup/context cost. Provider switching is process-local and blocked during a generation. No silent fallback.

CLI selection defaults come from server-only .env.local. Connection settings allow provider/model selection for the running server, without reading or writing credentials. Executable paths remain environment-only. Application data remains in IndexedDB; switching providers does not erase it.

The Figma adapter extracts supported rendered state into DesignIR and copies text to the clipboard. A separate offline plugin validates it and creates native layers. It does not carry web interactions, generate prototypes or synchronize files. The browser/React renderer remains the source of the visual result.

Next.js telemetry is disabled in the supplied dev/build/start commands; catalog generation uses --no-telemetry. Third-party AI CLI telemetry remains governed by that provider's settings.

No OpenRouter, Vercel-specific integration, Upstash, shared API key, allowance service, accounts, telemetry or cloud project storage is included. Internet is normally required for provider inference and initial dependency installation. Merely running the UI locally does not make inference offline.

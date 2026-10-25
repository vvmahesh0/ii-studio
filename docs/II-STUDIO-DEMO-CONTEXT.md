# II studio — Product, Demo and Presentation Context

Updated: 25 October 2026  
Creator: Mahesh V V · https://github.com/vvmahesh0  
Scope: current local release application. This guide describes implemented behavior, not a future roadmap. It is context for a video creator, presentation designer, or another AI model; no video or slides are included.

## 1. Product in one sentence

**II studio turns natural-language requirements into interactive interface previews and editable flowcharts, with refinement and creative history saved locally.**

The two studios share one workspace:

- **Interface:** explore a screen, section or widget using established components.
- **Flowchart:** explain a process, visualize its branches, and edit the result.

The product helps designers, business analysts, product managers and founders make an idea tangible before committing to detailed design or development.

Suggested positioning: **Describe an idea. See it take shape. Refine it. Keep your work.**

## 2. What the application is today

II studio is a local-first web application running in a browser on a Mac. Setup targets macOS arm64/x64 and native Windows 11 x64. Intel Mac and Windows support is experimental; platform/provider live verification is tracked separately in PLATFORM-SUPPORT.md. It is not yet a packaged native macOS application or a public hosted service.

The interface, registered component libraries, diagram editor, validation, automatic diagram layout, image export and workspace storage run locally. AI requests go through an installed, authenticated CLI. Cloud-backed models still use their provider's servers; running the CLI on a Mac does not make inference offline.

There is no II studio account, payment flow, shared trial key, cloud project synchronization or hosted quota system in this local release. The user supplies their existing provider connection. Provider subscriptions, model availability, costs and limits still apply; do not describe generation as unlimited or wholly offline.

## 3. Screens and visible surfaces

| Surface | What users see and do |
|---|---|
| Interface Studio | Idea composer, Modern/Default selector, starter prompts, rendered preview, refinement controls, export menu and artifact versions. |
| Flowchart Studio | Process composer, starter prompts, editable canvas, diagram tools, inspector, details and artifact versions. |
| Navigation drawer | Projects, Unfiled conversations, artifacts, local search and organization actions. Opens over the page without reducing canvas width. |
| AI connection modal | Installed-provider selection, model choice or configured model information, and connection controls. |
| Fullscreen preview | Expanded Interface preview or Flowchart canvas using the existing fullscreen action. |
| Flowchart inspector | Selected step/arrow labels, step type, connections and deletion controls. |
| Flow details modal | Diagram outline and disclosed assumptions. Uses Close to dismiss. |
| Figma development plugin | Experimental clipboard-to-editable-layers transfer. Separate from the studio application. |

Interface and Flowchart are modes of the same workspace, not separate accounts or products. The main page uses the full available width by default.

## 4. Interface Studio

### Start with a requirement

Users describe what they want: a pricing section, dashboard, contact form, settings screen, searchable table, task list or another supported composition.

The composer includes:

- A prompt textarea, with a 20,000-character limit and character count.
- **Modern / Default** segmented control.
- Context-sensitive Generate UI, Refine UI or Refine selection action.
- Starter prompts appropriate to the chosen library.
- Stop while a request is running.

Generate/Refine is disabled when the textarea is empty or whitespace-only. Empty Enter-key submissions are blocked. The submitted requirement remains visible after generation; reopening an older saved version starts with an empty refinement draft and exposes its instruction separately.

### Two component libraries

**Default** is the original component library. **Modern** uses adapted shadcn-based components and curated blocks. Both use Avenir Next when available, with local font fallbacks. Their component styling differs; Modern is not simply a color filter over Default.

Modern includes four flexible model-facing blocks:

- **AppShell:** brand, grouped navigation, active selection, collapsible sidebar and content.
- **MetricCards:** configurable metric labels, values, descriptions and trends.
- **DashboardSection:** heading, description, actions and nested content.
- **AuthLayout:** login/signup presentation wrapping supported forms.

Blocks are combined with primitives rather than forcing every request into a fixed template. Available content includes text, cards, layouts, buttons, badges, forms, tables, lists, charts and other registered controls. Coverage varies by library; it is not the entire shadcn ecosystem.

Changing libraries starts a new working interface context and preserves saved work. Do not present the toggle as a guaranteed one-click restyling of an existing result.

### Progressive rendering

The app displays useful, valid partial interface output while the model is still responding, when the selected transport provides suitable chunks. Users do not have to wait for the entire response before seeing anything.

The output is structured component instructions, not arbitrary model-written HTML, CSS or executable React code. The app validates those instructions and renders its own registered components.

Streaming granularity depends on provider. A provider that returns complete message chunks may reveal content later than one that streams smaller pieces. Do not promise identical progressive behavior or fixed timings across models.

### Interactions inside generated interfaces

Supported interactions operate on local/sample data without another AI request:

- Forms can validate required fields and supported input rules, show errors, check values locally and reset to initial values.
- Tables can opt into search, exact-value column filters, sorting, result counts, reset and pagination.
- DataList can support search, status filtering, title sorting, reset and pagination.
- Supported tabs, accordions and similar controls can change local presentation.
- AppShell supports local navigation highlighting and sidebar collapse.

These features need to be represented in the generated configuration. A decorative search input placed near a table is not automatically connected to it.

A login screen does not authenticate a real account. A contact form does not send an email. Navigation does not automatically create working routes. Generated screens do not fetch live business data or deploy an application.

### Whole-interface refinement

After a completed result, describe a change and use Refine UI. The app sends the relevant current result and request to the model, validates the response and saves a successful meaningful iteration as another version of the same artifact.

### Targeted refinement

1. Choose **Select to refine** in the preview toolbar.
2. Select a supported component in the rendered interface.
3. The composer shows a Selected chip, Select parent when available, Clear selection, and a scope badge.
4. Describe the requested change and choose Refine selection.
5. The app merges a validated scoped result into the existing interface.

Preview mode allows normal local interactions. Selection mode intercepts interactions to select components. Select parent widens the chosen scope explicitly; Clear selection exits it.

Targeted refinement aims to preserve unrelated definitions. Shared components/state and some portaled internals cannot always be refined independently; the app can ask users to select a parent or use whole-interface refinement. It does not silently widen scope. Some renderer state can be retained, but this is not universal persistence of every component's private state.

### Interface toolbar and handoff

The preview header keeps a grid icon and Preview / Select to refine on the left. Export, View full screen and Clear sit on the right.

Export provides:

- **Copy PNG:** rendered interface image to the clipboard, subject to browser permissions.
- **Export PNG:** download an image, using the artifact title for its filename.
- **Copy for Figma:** experimental editable-design transfer for supported interfaces.

Image capture excludes studio chrome and selection graphics, aims to include full content rather than only the visible viewport, and preserves current supported local state. Tall content, internal scroll areas, external images, portals, browser canvas limits and unsupported effects can impose limitations. Close floating dialogs/popovers when needed. Clipboard failure must not be presented as success; PNG download is the fallback.

## 5. Flowchart Studio

### Generate from business logic

Users describe a business process or product journey. Typical examples include purchase approval, account onboarding, refund handling, eligibility checks and escalation paths.

Supported node types: **Start, End, Process, Decision, Input/Output and Note**. The current contract allows at most **30 nodes and 60 edges**. This is a flowchart editor, not a formal BPMN or swimlane tool.

The model supplies nodes, connections, labels, direction and disclosed assumptions. Local layout places them on the canvas. The model does not generate coordinates, React code or diagram CSS.

### Accuracy safeguards

The app checks structural rules such as unique IDs, valid endpoints, one Start, at least one End, reachable steps, routes to an End and meaningful decision branches. Retry loops need an exit path.

A structurally valid graph is not proof of correct business policy. Users still need to review whether the requested branches, exceptions and thresholds are represented correctly.

If missing information materially changes business logic, the same model response can ask a clarification question. The answer is submitted with the original requirement and relevant diagram. Assumptions can be inspected in Flow details.

### Progressive display and recovery

A connected provisional portion can appear during generation before final validation and layout. Editing is disabled during generation, and Stop remains available. Failure or cancellation preserves the previous completed diagram.

### Direct editing

Users can:

- Drag steps.
- Edit step and arrow labels.
- Change supported step types.
- Add/delete steps and connect/reconnect arrows.
- Inspect outgoing connections.
- Undo/redo manual edits within a bounded history.
- Pan, zoom and Fit view.
- Re-layout the diagram.
- Switch Top to bottom / Left to right direction.

Deleting a node removes its incident arrows rather than silently connecting unrelated steps. Nonblocking structural warnings can appear while a manually edited graph is incomplete.

AI refinement uses the current diagram, including manual edits. Label-only changes preserve positions where possible; membership or connection changes can trigger re-layout.

### Sharing

Flowcharts support fullscreen, Copy PNG and Export PNG. Diagram capture covers the diagram's full bounds with its existing padding/background rules rather than cropping to the viewport, excluding editor controls and selection handles.

Manual changes are preserved as working state for the selected version; they do not create a new AI-generation version for every drag.

## 6. Projects, conversations, artifacts and versions

These concepts are distinct:

```text
Project or Unfiled
  Conversation
    Dashboard artifact
      v1: initial generation
      v2: add a revenue chart
      v3: refine a selected card
    Login artifact
      v1: a separate interface after Clear
    Onboarding artifact
      v1: a flowchart
```

- **Project:** organizes related conversations.
- **Conversation:** groups related artifacts; it is not a full chat transcript sent wholesale to the model.
- **Artifact:** one generated interface or flowchart.
- **Version:** a successful meaningful AI iteration of that artifact.

The drawer supports local search, reopening work, project creation, renaming, conversation organization and deletion with confirmation. Titles are kept compact for navigation.

**New** starts a fresh conversation in the current project. **Clear** resets the working context within the current conversation so the next successful generation becomes a new artifact. Neither action deletes saved history.

The compact Artifact Versions menu shows numbered versions and their change instructions. Users can revisit earlier results and refine from them. Successful results autosave, with Saving/Saved locally feedback. Failed or cancelled output does not replace the last valid artifact.

### Storage boundary

Projects and history use browser IndexedDB. They persist across refreshes and return visits in the same browser profile and origin. Another browser, profile or port has a separate workspace. Clearing site data, private browsing or storage eviction can lose work. There is no cloud sync or cross-device identity.

Workspace backup import/export is implemented internally but **currently hidden from the product UI**. Do not show it as an available feature in a demo or instruct viewers to click backup buttons.

## 7. AI connection and speed

The connection control shows provider/model information and opens the modal. Model discovery is available for supported CLIs; manual configuration/default behavior applies where discovery is unavailable. Detected installation does not prove sign-in or model entitlement.

- **Antigravity:** existing Gemini integration; real generation/refinement checks are recorded in the repository.
- **Codex:** real generation/refinement checks are recorded; message chunk behavior differs from token streaming.
- **Claude Code:** experimental adapter; successful live support is not established in current release documentation.
- **Gemini CLI:** experimental adapter; separate from Antigravity and not live-verified on this test Mac.

Do not promote all adapters as equally tested. The app does not silently switch providers when one fails.

Generation uses a provider adapter, structured contracts, local validation and bounded correction. No separate design-planning or review model stage is added. A separate Design Quality Skill is not enabled by this release work.

Speed depends on connection preparation, provider load, model, output size and correction needs. For a demo, connect and warm the provider before recording. Show honest observed performance rather than claiming every result completes within five seconds. Preserve the visible progressive result; do not replace it with a long full-screen loader.

## 8. Figma transfer: optional experimental segment

1. Open a completed supported Interface.
2. Choose Export → Copy for Figma.
3. Run the local **II studio** development plugin in Figma Desktop.
4. Click its paste area, then press Command–V.
5. Supported content becomes editable layers on a white-filled root frame.

The plugin validates and imports automatically, with “Imported successfully” feedback. Its panel resizes around visible feedback. The separate file-import card and import-report controls are hidden.

Transfer is partial and experimental, not pixel-perfect compatibility for every component. It does not transfer working web interactions or provide live synchronization. Some icons/charts become vectors. Unsupported content may need PNG export instead. Repeating an import creates another screen, not a synchronized update.

Use this segment only after checking the exact example in Figma. Do not make it the central promise of the demo.

## 9. Current visual and interaction language

- White and pale blue surfaces, restrained blue primary actions, thin outlines and rounded panels.
- Avenir Next typography on supported Macs.
- Full-width workspace with slide-out navigation.
- Smooth sliding indicators for Interface/Flowchart, Modern/Default and Preview/Select to refine.
- Studio page crossfade where the browser supports View Transitions, with a directional entry fallback.
- Reduced-motion preferences respected.
- Blue text-selection background with white selected text.
- Minimal status feedback and compact version navigation.

Motion must not hide streamed generation or introduce a model wait. Keep screenshots current: older repository screenshots can contain retired labels, timings or backup controls.

## 10. Suggested 3–4 minute demo

Durations below are editorial guidance, not product latency claims.

| Segment | Show | Explain |
|---|---|---|
| 0:00–0:20 | Product and two studio modes | One workspace for interface ideas and process thinking. |
| 0:20–1:00 | Enter a dashboard prompt; show progressive result | Natural language becomes an interactive preview using registered components. |
| 1:00–1:35 | Search/filter table; select a card and refine it | Supported interactions work locally; refinement can target a chosen component. |
| 1:35–1:55 | Open Artifact Versions and navigation drawer | Work is autosaved and earlier iterations remain accessible. |
| 1:55–2:45 | Switch to Flowchart; generate a purchase process | Business rules become an editable flow with explicit branches. |
| 2:45–3:15 | Rename/move a step, adjust an arrow, Fit view | Users can combine AI generation with direct control. |
| 3:15–3:35 | Fullscreen and PNG export | Review and share the result without studio controls. |
| Optional | Figma paste with a prechecked example | Supported interfaces can become editable design layers experimentally. |
| Closing | Return to both modes | Describe, generate, refine and revisit. |

Do not crop away errors to imply a failed request succeeded. If footage is sped up, identify it. Keep private prompts, provider details and unrelated browser tabs out of the recording.

### Suggested interface prompt

> Create a desktop customer support dashboard with four summary metrics, a weekly ticket chart, and a support tickets table. Include local search, status filtering, sorting and pagination. Use realistic sample data and a compact, clear layout.

### Suggested targeted refinement

> Change this card's title to “Resolved this week” and make its supporting description shorter. Preserve the remaining content.

Select a suitable card before sending the request. Exact generated layouts may differ across runs.

### Suggested flowchart prompt

> An employee submits a purchase request. Incomplete requests return for revision. The manager approves or rejects it. Approved requests above ₹50,000 need finance approval; requests at or below ₹50,000 proceed directly to procurement. Finance may reject. Procurement places the order, and the employee confirms receipt. Show rejection outcomes and the revision loop.

### Suggested flow refinement

> Change the finance approval threshold to ₹75,000. Preserve the other rules and outcomes.

### Recording preparation

- Use the intended local app URL and browser profile; prepare a small demo project.
- Connect a verified provider and confirm readiness before recording.
- Run the exact prompts beforehand; review supported interactions and process correctness.
- Keep one good saved interface and flowchart available as recovery examples.
- Check PNG clipboard/download permissions and fullscreen behavior.
- Test Figma separately if including the optional transfer segment.
- Record the current UI, not historical screenshots.

## 11. Suggested presentation structure

1. **II studio:** from a requirement to something people can see and use.
2. **Who it helps:** designers, analysts, product teams and founders exploring ideas.
3. **Two studios:** interactive interface previews and editable workflows.
4. **Interface workflow:** prompt → progressive preview → local interaction → refinement.
5. **Focused changes:** select a component, choose scope, refine the selection.
6. **Flowchart workflow:** describe rules → review branches → edit and refine.
7. **Creative history:** projects, conversations, artifacts, numbered versions and autosave.
8. **Review and handoff:** fullscreen, PNG copy/export; optional experimental Figma transfer.
9. **How it works:** structured model output + local registered renderers + validation + browser storage.
10. **Current boundaries:** local release, provider requirements, browser-local data and no production backend generation.

Use actual outputs and short before/after comparisons. Prefer one product point per slide. Present demo timings only when measured for the shown run.

## 12. Claims to use and claims to avoid

| Safe description | Avoid |
|---|---|
| Generates interactive previews from supported components | Builds and deploys complete production apps |
| Generates editable business/user flowcharts | Guarantees correct business policy |
| Saves projects and versions in this browser | Cloud backup or cross-device sync |
| Uses the user's installed AI CLI connection | Free unlimited or fully offline AI |
| Displays progressive output where transport permits | Every model streams instantly |
| Local forms/search/filtering over supplied data | Live databases, authentication or email delivery |
| Experimental editable Figma transfer | Universal perfect Figma export or live sync |
| Supports Default and Modern libraries | Includes every shadcn component or block |

## 13. Technical context for a content creator

The application uses Next.js/React/TypeScript. OpenUI definitions drive Interface rendering, with separate Default and Modern catalogs. React Flow provides diagram editing, and ELK supplies local automatic layout. IndexedDB stores workspace history. PNG actions capture rendered content locally. The CLI provider transport and model remain separate from these renderers.

Simple explanation for narration: **The model describes the result using a controlled vocabulary. II studio validates that description and turns it into familiar components or an editable diagram.**

No new model calls, benchmarks or runtime tests were performed to create this document. This guide was prepared from current source and repository documentation; historical performance reports are not new guarantees.

## 14. Source references for follow-up

- `README.md`: local release overview and startup.
- `docs/ARCHITECTURE.md`: system structure.
- `docs/LOCAL-WORKSPACE.md`: organization and persistence; its older backup instructions are superseded by the current hidden-control setting.
- `docs/LOCAL-INTERACTIONS.md`: actual forms, tables and lists behavior.
- `docs/TARGETED-REFINEMENT.md`: selection scope, merging and limitations.
- `docs/PROVIDERS.md` and `docs/MODEL-SELECTION.md`: connection support and discovery.
- `docs/COPY-EXPORT.md`: image capture coverage and browser limitations.
- `docs/PAPER-UI-UPDATE.md`: recent UI changes and verification boundaries.
- `app/workspace/navigation.tsx`: backup controls currently disabled through SHOW_WORKSPACE_BACKUPS=false.
- `tools/figma-adapter-poc/plugin/`: current experimental paste-only plugin UI.

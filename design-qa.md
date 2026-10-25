# Paper reference implementation QA

final result: passed

## Exact targets
- II plugin: Paper file 01M4D8E5MTG55WF4YGVPRP3EQC, page p-1-0, node 2ME-0 (440 px plugin panel, excluding Figma-owned window chrome).
- AI connection modal: same file/page, node 33T-0 (440 × 384 default state).
- Export menu/model pill: same file/page, node 2KW-0 (1440 × 960 screen).
- Workspace backup controls: user-attached screenshot; centered row with 18 px top spacing below the existing divider.

References were opened and visually inspected through Paper CDP; modal dimensions, spacing, fonts and styles were read from its actual node tree/JSX. Paper documents were not edited.

## Implemented scope
- Export dropdown with Copy PNG, Export PNG and Copy for Figma; fullscreen and Clear stay separate.
- One AI model/provider pill opens the styled connection modal; available CLI detection and custom model entry remain truthful, without an invented entitlement/model catalog.
- Plugin card UI, native editable paste target, input fallback, drag/drop JSON import and retained bounded import/report states.
- Centered backup actions with spacing. Avenir Next and existing blue visual language retained.
- Reference-only PRO badge and .iistudio-bundle claim omitted because those capabilities are not present. Existing Preview/Select to refine remains.

## Verification completed
- Production build, TypeScript and ESLint passed.
- 136 automated tests passed, including 6 new native-paste-field/protocol tests and a pending-clipboard timeout regression test using a VM DOM harness. Existing clipboard activation/denial and importer transaction tests remain passing.
- No generation prompts or model turns were added by the UI redesign; connection metadata requests do not perform inference.

## Live verification after reconnect
- Browser control connected. A new Modern project-summary interface generated through the actual app and was restored after refresh.
- AI connection modal, model pill, Export dropdown and centered backup actions visually checked against Paper references. Screenshots: /tmp/ii-connection-modal.png, /tmp/ii-export-menu.png, /tmp/ii-backup-buttons.png.
- Plugin initial screenshot cropped to 440 × 580 and viewed together with Paper node 2ME-0. Card bounds, spacing, hierarchy, white surface and footer match the reference treatment. Figma's native titlebar follows the user's dark Figma appearance; unsupported bundle claims remain omitted. Minor font-weight variation is nonblocking.
- Native fullscreen exposed a hidden dropdown portal. The menu now portals inside the fullscreen element; all three actions appear there. Offscreen capture surfaces also stay in the fullscreen layer.
- Normal preview Copy PNG reports Copied, and Export PNG reports PNG exported. In this automated browser, native-fullscreen clipboard completion can remain pending; a bounded clipboard wait now releases the toolbar and provides Export PNG fallback rather than reporting false success.
- Actual updated Figma plugin received the app-generated DesignIR through a native paste event and automatically imported 40 editable layers into the disposable Phase 0 file. Native layer tree includes text, layout frames, progress and button layers; plugin reported Imported successfully. Screenshot: /tmp/ii-figma-import-success.png.
- Ordinary-text paste was rejected with a useful error; the next valid paste succeeded without restarting.
- Automation caveat: browser clipboard and macOS clipboard were isolated. The expected app-copied payload was relayed using the native clipboard bridge before paste. This verifies native paste/import, but is not proof of an unmediated cross-app OS clipboard handoff.
- Updated plugin is registered alongside an older entry with the same name. Use the white two-card panel from the release manifest.

No unsupported component fidelity or every-browser clipboard claim is made. The original prototype and user workspace were not modified by source changes.

Final browser check confirmed native-fullscreen clipboard timeout exits cleanly, and its Export PNG fallback completes successfully. Evidence copies are retained in the sibling release/ui-verification directory.

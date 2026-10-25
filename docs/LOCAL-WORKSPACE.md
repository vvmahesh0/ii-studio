# II studio local projects and creative history

## Using it

1. Open `http://127.0.0.1:3000/` in your usual browser. Generate immediately; no project or Save button is required.
2. A successful result creates an **artifact**. Its submitted requirement and structured result are saved automatically in this browser's IndexedDB. A new **conversation** is created only when its first artifact succeeds.
3. Describe a change to refine the selected artifact. Each successful refinement adds an immutable numbered version. **Artifact Versions** opens older results and their instructions. Refining v1 after v4 creates v5 with v1 as its parent.
4. **Clear** opens a blank artifact context within the same conversation. Your next successful generation becomes a separate artifact. It does not delete saved work.
5. **New** starts a fresh conversation in the current project, preserving saved work. Switch Interface/Flowchart as needed; a conversation can contain both kinds.
6. Open the hamburger beside the logo for projects, conversations and artifacts. It overlays the canvas without changing the main layout. Create a project before generating if you want an explicit destination, or keep work Unfiled.
7. Item menus support rename and confirmed permanent deletion. Conversations can be moved to another project or Unfiled, together with their artifacts. Search matches project/conversation names and artifact titles locally.
8. Submitted text stays visible immediately after generation. When reopening a saved version, the refinement box starts empty; expand **Selected version's instruction** to see its historical instruction and original requirement.
9. **Saving…** changes to **Saved locally** only after the write completes. On failure, keep the tab open and retry. New/Clear/navigation are guarded while writes are pending or failed.
10. **Export backup / Import backup** are secondary actions at the bottom of the drawer. Export keeps a versioned JSON file. Import merges valid work without silently overwriting conflicts.

## Organization

```
Project (or Unfiled)
  Conversation
    Interface artifact
      v1 → v2 → v3
           ↘ v4 (a refinement based on v2)
    Flowchart artifact
      v1 → v2
```

A conversation is an organizational context, not a chat transcript. Refinement sends the selected artifact's current result through the existing generation API. Clearing intentionally removes that working context; it does not send every artifact in a conversation to Gemini.

## Persistence architecture

- `app/lib/workspace/model.ts`: validated project, conversation, artifact, discriminated generation and flowchart-working-document envelopes.
- `storage.ts`: IndexedDB version 1 using the small `idb` wrapper. Stores: projects, conversations, artifacts, generations, working, meta. Indexes support project/conversation/artifact lookup; `(artifactId, version)` is unique.
- `persistGeneration`: validates the record envelope, version number, parent and ownership; commits conversation/artifact/generation/active pointers together. AI generation snapshots are never overwritten by manual edits.
- `app/workspace/context.tsx`: queued writes, autosave status, navigation context, restoration, pending-write retention and retry. Writes are separate from model streaming and do not invoke another model.
- `app/workspace/navigation.tsx`: overlay drawer, local search, inline naming, destructive confirmations, current context and prompt history.
- `backup.ts` and `portability.tsx`: bounded versioned JSON, integrity checks, registered-content validation, collision-safe ID remapping and transactional merge.
- Existing Interface and Flowchart studios keep their renderers, generation streams, validation, cancellation and editing behavior. Completion callbacks connect them to persistence.

### Flowchart edits

The original AI snapshot belongs to a generation record. A separate working document holds committed manual changes and geometry for that generation. Writes debounce for 400 ms at editing boundaries; drag-move events remain transient and only drag completion queues a position save. Viewport changes save at move-end. Pending changes flush when leaving the document or hiding the tab. A pending-write unload warning reduces accidental loss, but an abrupt browser/OS crash during the debounce window can still lose the latest edit.

Undo/Redo remains bounded within the current editing session and is not restored after a restart. Local sample-interface interaction state remains in-session; form entries and dropdowns are not durably serialized. Unsent composer drafts are not durable history.

### Version and schema compatibility

Database version 1 initializes stores only on first use. Future migrations belong in the central `upgrade` handler; no reset-on-upgrade is used. Each generation has schema version 1 and the Interface library contract revision or Flowchart revision. Restoring a selected generation checks the current registered contract. Unsupported results remain stored with an actionable error instead of being silently converted or executed. Earlier generation data is loaded for the selected artifact, not for every sidebar entry.

### Conflicts and failures

Each transaction compares a workspace revision in the same read/write transaction. A stale tab cannot overwrite newer work. BroadcastChannel reports changes from other tabs promptly. This MVP conservatively asks you to reload a stale tab; it does not attempt collaborative merges. Generation content already rendered remains in memory when saving fails, and failed write tasks can be retried. Failed/provisional/stopped generations do not become saved versions.

Project deletion removes its conversations, artifacts, generations and working documents in one transaction. Artifact deletion removes its versions/working document and prunes an empty conversation. There is no trash. Confirmation clearly states the impact.

### Portable backups

Backups contain only projects, conversations, artifacts, generation content, working documents and required metadata. Provider credentials, CLI authentication, browser cookies and internal logs are not collected. User-authored requirements and generated sample content are included.

Imports accept format `ii-studio-backup`, version 1, up to 25 MB. They validate record shapes, IDs, version sequences/parents, ownership and registered content. Identical records are skipped. When any IDs conflict with different content, the imported hierarchy gets new IDs with all references remapped, preserving both copies. Import is atomic and never replaces the current workspace. Older unsupported formats are rejected rather than guessed.

## Local-only limitations

- Data belongs to the exact browser/profile and origin (including hostname/port). `localhost` and `127.0.0.1` have separate storage. Use the same address consistently.
- Browser cleanup, private-window closure, eviction, or profile removal can erase IndexedDB. Export a backup for a separate copy. Nothing syncs between devices or browsers.
- The app still uses the existing remote Gemini provider through authenticated Antigravity; saving and rendering add no hosted dependency or provider call.
- No accounts, chat transcripts, cloud syncing, model management, Figma adapter or desktop packaging were added.
- No default/demo projects or generated artifacts are seeded. Browser verification data was created through real generation, not installed as placeholder content.

## Run and verify

From the `prototype` directory:

```sh
npm ci
npm run build
npm start
```

Open the app, generate, wait for Saved locally, refresh and reopen from the drawer. Refine several times, reopen v1, refine again and check that the next numbered version is added. Create an unrelated artifact with Clear, and a separate conversation with New. Edit a flowchart label/position/branch, wait for Saved locally and refresh. Export and import a backup to verify portability.

Engineering checks:

```sh
npm test
npx tsc --noEmit
npm run lint
```

Stop the running production server before rebuilding its `.next` directory. See `docs/verification/local-workspace/README.md` for the actual verification record and limitations.

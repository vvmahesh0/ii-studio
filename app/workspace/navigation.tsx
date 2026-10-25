"use client";
import { useState } from "react";
import { Dialog, DropdownMenu } from "radix-ui";
import {
  ChevronDown,
  Folder,
  LayoutGrid,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  X,
  Workflow,
} from "lucide-react";
import { useWorkspace } from "./context";
import { StudioDialog } from "../studio/components";
import type { Artifact, Conversation } from "../lib/workspace/model";

// Keep backup implementation available while its user-facing controls are paused.
const SHOW_WORKSPACE_BACKUPS = false;

type Item = {
  type: "projects" | "conversations" | "artifacts";
  id: string;
  title: string;
};
export function WorkspaceNavigation() {
  const w = useWorkspace();
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState<
    Item | { type: "create"; id: string; title: string } | null
  >(null);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<Item | null>(null);
  const disabled =
    w.busy ||
    w.status === "loading" ||
    w.status === "saving" ||
    w.status === "error";
  const q = query.trim().toLowerCase();
  function openEdit(item: Item) {
    setEdit(item);
    setName(item.title);
  }
  function actions(item: Item) {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="workspace-item-menu"
          aria-label={`Actions for ${item.title}`}
          disabled={disabled}
        >
          <MoreHorizontal size={15} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="workspace-menu" sideOffset={5}>
            <DropdownMenu.Item onSelect={() => openEdit(item)}>
              Rename
            </DropdownMenu.Item>
            {item.type === "conversations" && (
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>Move to…</DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent className="workspace-menu">
                    <DropdownMenu.Item onSelect={() => w.move(item.id, null)}>
                      Unfiled
                    </DropdownMenu.Item>
                    {w.index.projects.map((p) => (
                      <DropdownMenu.Item
                        key={p.id}
                        onSelect={() => w.move(item.id, p.id)}
                      >
                        {shortTitle(p.name)}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
            )}
            <DropdownMenu.Item
              className="workspace-danger"
              onSelect={() => setDeleting(item)}
            >
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }
  function artifactRow(a: Artifact) {
    const Icon = a.type === "interface" ? LayoutGrid : Workflow;
    const selected =
      w.artifactFor(w.sessions[a.type].key)?.id === a.id && w.mode === a.type;
    return (
      <div
        className={`workspace-nav-row ${selected ? "is-selected" : ""}`}
        key={a.id}
      >
        <button
          className="workspace-nav-link"
          disabled={disabled}
          aria-current={selected ? "page" : undefined}
          onClick={() => {
            void w.openArtifact(a.id).then(() => w.setDrawerOpen(false));
          }}
        >
          <Icon size={14} />
          <span>{localTitle(a.title)}</span>
        </button>
        {actions({ type: "artifacts", id: a.id, title: a.title })}
      </div>
    );
  }
  function conversationRow(c: Conversation) {
    const artifacts = w.index.artifacts
      .filter((a) => a.conversationId === c.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return (
      <details
        className="workspace-conversation"
        key={c.id}
        open={c.id === w.conversationId || undefined}
      >
        <summary>
          <MessageSquare size={13} />
          <span>{localTitle(c.title)}</span>
          <ChevronDown size={12} />
        </summary>
        <div className="workspace-conversation-tools">
          <button
            disabled={disabled}
            onClick={() => {
              void w.openConversation(c.id).then(() => w.setDrawerOpen(false));
            }}
          >
            Open conversation
          </button>
          {actions({ type: "conversations", id: c.id, title: c.title })}
        </div>
        <div className="workspace-artifacts">{artifacts.map(artifactRow)}</div>
      </details>
    );
  }
  const conversations = [...w.index.conversations].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const matchedProjects = w.index.projects.filter((p) =>
    p.name.toLowerCase().includes(q),
  );
  const matchedConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(q),
  );
  const matchedArtifacts = w.index.artifacts.filter((a) =>
    a.title.toLowerCase().includes(q),
  );
  const deletingConversations =
    deleting?.type === "projects"
      ? conversations
          .filter((c) => c.projectId === deleting.id)
          .map((c) => c.id)
      : deleting?.type === "conversations"
        ? [deleting.id]
        : [];
  const affected =
    deleting?.type === "artifacts"
      ? 1
      : w.index.artifacts.filter((a) =>
          deletingConversations.includes(a.conversationId),
        ).length;
  return (
    <>
      <Dialog.Root open={w.drawerOpen} onOpenChange={w.setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="workspace-drawer-overlay" />
          <Dialog.Content
            className="workspace-drawer"
            aria-describedby="workspace-drawer-description"
          >
            <div className="workspace-drawer-header">
              <Dialog.Title>II studio</Dialog.Title>
              <Dialog.Close
                aria-label="Close navigation"
                className="studio-icon-button"
              >
                <X size={18} />
              </Dialog.Close>
            </div>
            <Dialog.Description
              id="workspace-drawer-description"
              className="studio-sr-only"
            >
              Projects, conversations and saved creations.
            </Dialog.Description>
            <button
              className="workspace-new"
              disabled={disabled}
              onClick={() => {
                w.newConversation();
                w.setDrawerOpen(false);
              }}
            >
              <Plus size={16} />
              New conversation
            </button>
            <label className="workspace-search">
              <Search size={15} />
              <input
                aria-label="Search saved work"
                placeholder="Search saved work"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {edit && (
              <form
                className="workspace-edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!name.trim()) return;
                  if (edit.type === "create") w.createProject(name);
                  else w.rename(edit.type, edit.id, name);
                  setEdit(null);
                }}
              >
                <label>
                  {edit.type === "create" ? "New project" : "Rename"}
                  <input
                    autoFocus
                    maxLength={180}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div>
                  <button type="button" onClick={() => setEdit(null)}>
                    Cancel
                  </button>
                  <button className="workspace-edit-primary" disabled={!name.trim() || disabled}>{edit.type === "create" ? "Create" : "Save"}</button>
                </div>
              </form>
            )}
            <nav className="workspace-nav" aria-label="Saved work">
              {q ? (
                <>
                  {!matchedProjects.length &&
                    !matchedArtifacts.length &&
                    !matchedConversations.length && (
                      <p className="workspace-empty">
                        No matching projects or artifacts.
                      </p>
                    )}
                  {matchedProjects.map((p) => (
                    <div className="workspace-nav-row" key={p.id}>
                      <button
                        className="workspace-nav-link"
                        disabled={disabled}
                        onClick={() => {
                          w.newConversation(p.id);
                          w.setDrawerOpen(false);
                        }}
                      >
                        <Folder size={14} />
                        <span>{shortTitle(p.name)}</span>
                      </button>
                    </div>
                  ))}
                  {matchedConversations.map((c) => (
                    <div className="workspace-nav-row" key={c.id}>
                      <button
                        className="workspace-nav-link"
                        disabled={disabled}
                        onClick={() => {
                          void w
                            .openConversation(c.id)
                            .then(() => w.setDrawerOpen(false));
                        }}
                      >
                        <MessageSquare size={14} />
                        <span>{localTitle(c.title)}</span>
                      </button>
                    </div>
                  ))}
                  {matchedArtifacts.map((a) => (
                    <div key={a.id}>
                      {artifactRow(a)}
                      <small className="workspace-search-location">
                        {a.type === "interface" ? "Interface" : "Flowchart"} ·{" "}
                        {w.index.projects.find(
                          (p) =>
                            p.id ===
                            conversations.find((c) => c.id === a.conversationId)
                              ?.projectId,
                        )?.name ?? "Unfiled"}
                      </small>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="workspace-group-heading">
                    <button
                      disabled={disabled}
                      onClick={() => {
                        w.newConversation(null);
                        w.setDrawerOpen(false);
                      }}
                    >
                      Unfiled
                    </button>
                    <button
                      aria-label="New unfiled conversation"
                      disabled={disabled}
                      onClick={() => {
                        w.newConversation(null);
                        w.setDrawerOpen(false);
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {conversations
                    .filter((c) => c.projectId === null)
                    .map(conversationRow)}
                  {!conversations.some((c) => c.projectId === null) && (
                    <p className="workspace-empty">
                      Your work will appear here.
                    </p>
                  )}
                  <div className="workspace-group-heading">
                    <span>Projects</span>
                    <button
                      aria-label="Create project"
                      disabled={disabled}
                      onClick={() => {
                        setEdit({ type: "create", id: "", title: "" });
                        setName("");
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {[...w.index.projects]
                    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                    .map((p) => (
                      <details
                        className="workspace-project"
                        key={p.id}
                        open={w.projectId === p.id || undefined}
                      >
                        <summary>
                          <Folder size={14} />
                          <span>{shortTitle(p.name)}</span>
                          <ChevronDown size={12} />
                        </summary>
                        <div className="workspace-project-tools">
                          <button
                            disabled={disabled}
                            onClick={() => {
                              w.newConversation(p.id);
                              w.setDrawerOpen(false);
                            }}
                          >
                            <Plus size={12} />
                            New conversation
                          </button>
                          {actions({
                            type: "projects",
                            id: p.id,
                            title: p.name,
                          })}
                        </div>
                        {conversations
                          .filter((c) => c.projectId === p.id)
                          .map(conversationRow)}
                        {!conversations.some((c) => c.projectId === p.id) && (
                          <p className="workspace-empty">
                            No interfaces or flowcharts yet.
                          </p>
                        )}
                      </details>
                    ))}
                  <button
                    className="workspace-create-project"
                    disabled={disabled}
                    onClick={() => {
                      setEdit({ type: "create", id: "", title: "" });
                      setName("");
                    }}
                  >
                    <Plus size={14} />
                    New project
                  </button>
                </>
              )}
            </nav>
            {SHOW_WORKSPACE_BACKUPS && (
              <div className="workspace-drawer-footer">
                <WorkspaceBackupActions
                  disabled={
                    w.busy || w.status === "loading" || w.status === "saving"
                  }
                />
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <StudioDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`Delete ${deleting?.title ?? ""}?`}
        description={
          deleting?.type === "artifacts"
            ? "This removes this creation and all its versions permanently."
            : `This removes ${affected} ${affected === 1 ? "artifact" : "artifacts"} and all their versions permanently. This cannot be undone.`
        }
        footer={
          <>
            <button
              className="studio-secondary"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              className="workspace-delete-confirm"
              onClick={() => {
                if (deleting) w.remove(deleting.type, deleting.id);
                setDeleting(null);
              }}
            >
              Delete permanently
            </button>
          </>
        }
      >
        {SHOW_WORKSPACE_BACKUPS && (
          <p>Export a backup first if you want to keep a separate copy.</p>
        )}
      </StudioDialog>
    </>
  );
}
// The portability controls are implemented after the primary creation workflow.
import { localTitle, shortTitle } from "../lib/workspace/model";
import { WorkspaceBackupActions } from "./portability";
export function WorkspaceContextBar() {
  const w = useWorkspace();
  const artifact = w.artifactFor(w.sessions[w.mode].key);
  const conversation = w.index.conversations.find(
    (c) => c.id === w.conversationId,
  );
  const project = w.index.projects.find((p) => p.id === w.projectId);
  return (
    <div className="workspace-context-bar">
      <div className="workspace-context-title">
        <span>
          {project ? shortTitle(project.name) : "Unfiled"}
          {conversation ? ` / ${localTitle(conversation.title)}` : ""}
        </span>
        {artifact && <strong>{localTitle(artifact.title)}</strong>}
      </div>
      <div className="workspace-context-actions">
        <button
          className="studio-secondary"
          disabled={w.busy || w.status !== "saved"}
          onClick={() => w.newConversation()}
        >
          <Plus size={13} />
          New
        </button>
      </div>
      {w.error && (
        <div className="workspace-storage-error" role="alert">
          <span>{w.error} Keep this tab open to preserve unsaved work.</span>
          <button onClick={w.status === "error" ? w.retry : w.dismissError}>
            {w.status === "error" ? "Retry saving" : "Dismiss"}
          </button>
        </div>
      )}
    </div>
  );
}
export function InstructionContext({
  instruction,
  original,
}: {
  instruction: string;
  original: string;
}) {
  return (
    <details className="workspace-instruction">
      <summary>Selected version’s instruction</summary>
      <p>{instruction}</p>
      {original !== instruction && (
        <>
          <strong>Original requirement</strong>
          <p>{original}</p>
        </>
      )}
    </details>
  );
}

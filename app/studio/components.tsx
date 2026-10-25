"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ConnectionSettings } from "./connection-settings";
import Link from "next/link";
import { WorkspaceSaveStatus } from "../workspace/save-status";
import { useWorkspace } from "../workspace/context";
import { Dialog, DropdownMenu } from "radix-ui";
import {
  Check,
  ChevronDown,
  Columns3,
  History,
  LayoutGrid,
  LoaderCircle,
  Maximize2,
  Menu,
  Minimize2,
  Trash2,
  Workflow,
  X,
} from "lucide-react";

export function StudioHeader({
  modeControls,
  connection,
  preparing,
  reconnect,
}: {
  modeControls: ReactNode;
  connection: "connecting" | "ready" | "failed";
  preparing: string;
  reconnect: () => void;
}) {
  void reconnect;
  const workspace = useWorkspace();
  return (
    <header className="studio-header">
      <div className="studio-brand-group">
        <button
          type="button"
          className="studio-icon-button"
          aria-label="Open navigation"
          aria-expanded={workspace.drawerOpen}
          onClick={() => workspace.setDrawerOpen(true)}
        >
          <Menu size={18} />
        </button>
        <Link className="studio-brand" href="/" aria-label="II studio">
          <span className="studio-logo">
            <Columns3 size={16} />
          </span>
          <strong>II studio</strong>
        </Link>
      </div>
      {modeControls}
      <ConnectionSettings connection={connection} preparing={preparing}/>

    </header>
  );
}

export function CanvasWaiting({
  mode,
  busy,
  elapsed = 0,
}: {
  mode: "interface" | "flowchart";
  busy?: boolean;
  elapsed?: number;
}) {
  const Icon = busy
    ? LoaderCircle
    : mode === "flowchart"
      ? Workflow
      : LayoutGrid;
  return (
    <div className="studio-waiting" role="status">
      <div className={`studio-waiting-mark ${busy ? "is-loading" : ""}`}>
        <Icon size={22} className={busy ? "studio-spin" : ""} />
      </div>
      <h2>
        {busy
          ? mode === "flowchart"
            ? "Structuring your process flow."
            : "Giving your idea some shape."
          : mode === "flowchart"
            ? "Start with a process, a decision, or a journey."
            : "Your next interface starts here."}
      </h2>
      <p>
        {busy
          ? "The first content will appear as the model responds."
          : mode === "flowchart"
            ? "Describe your flow above. Then make it your own on the canvas."
            : "Describe what you want to create, or try a starter above."}
      </p>
      {busy && (
        <span aria-hidden="true">{(elapsed / 1000).toFixed(1)}s elapsed</span>
      )}
    </div>
  );
}

export function VersionMenu({
  items,
  selectedId,
  disabled,
  onSelect,
}: {
  items: { id: number; label: string; description?: string }[];
  selectedId: number | null;
  disabled: boolean;
  onSelect: (id: number) => void;
}) {
  const current = items.find((v) => v.id === selectedId);
  return (
    <>
      <div className="studio-history">
        <span>Artifact Versions:</span>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className="studio-history-trigger"
            disabled={disabled || !items.length}
          >
            <span>
              {current
                ? current.label
                : items.length
                  ? "Choose a version"
                  : "No versions yet"}
            </span>
            <ChevronDown size={12} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              align="start"
              sideOffset={10}
              className="studio-version-menu"
            >
              <DropdownMenu.Label>
                <History size={13} /> Artifact Versions
              </DropdownMenu.Label>
              {items.map((v) => (
                <DropdownMenu.Item
                  key={v.id}
                  onSelect={() => onSelect(v.id)}
                  className="studio-version-item"
                  aria-label={v.label}
                >
                  <span>
                    <strong>{v.label}</strong>
                    {v.description && <small>{v.description}</small>}
                  </span>
                  {v.id === selectedId && <Check size={14} />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      <span className="studio-footer-meta">
        <WorkspaceSaveStatus />
        <span className="studio-creator">Created by <a href="https://www.linkedin.com/in/vvmahesh/" target="_blank" rel="noopener noreferrer">Mahesh V V</a></span>
      </span>
    </>
  );
}

export function PreviewActions({
  expanded,
  onFullscreen,
  onClear,
  disabled,
}: {
  expanded: boolean;
  onFullscreen: () => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const FullscreenIcon = expanded ? Minimize2 : Maximize2;
  return (
    <div className="studio-preview-actions">
      <button
        type="button"
        className="studio-preview-action"
        aria-pressed={expanded}
        onClick={onFullscreen}
      >
        <FullscreenIcon size={13} />
        {expanded ? "Exit full screen" : "View full screen"}
      </button>
      <button
        type="button"
        className="studio-preview-action studio-preview-clear"
        disabled={disabled}
        onClick={onClear}
      >
        <Trash2 size={13} />
        Clear
      </button>
    </div>
  );
}

/** Shared accessible overlay, independent from either generated component theme. */
export function StudioDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [portalHost, setPortalHost] = useState<Element | null>(() =>
    typeof document === "undefined" ? null : document.fullscreenElement,
  );
  useEffect(() => {
    const sync = () => setPortalHost(document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={portalHost}>
        <Dialog.Overlay className="studio-dialog-overlay" />
        <Dialog.Content className="studio-dialog">
          <div className="studio-dialog-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close
              className="studio-icon-button"
              aria-label="Close dialog"
            >
              <X size={17} />
            </Dialog.Close>
          </div>
          <div className="studio-dialog-body">{children}</div>
          <div className="studio-dialog-footer">
            {footer ?? (
              <Dialog.Close className="studio-primary">Close</Dialog.Close>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

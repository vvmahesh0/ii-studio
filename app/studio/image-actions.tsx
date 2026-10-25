"use client";
import {
  Check,
  Copy,
  Download,
  LoaderCircle,
  ChevronDown,
  Layers2,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useEffect, useState } from "react";
import type { useFigmaActions } from "./figma-actions";
import type { useImageActions } from "./use-image-actions";
export function ImageActions({
  actions,
  disabled = false,
}: {
  actions: ReturnType<typeof useImageActions>;
  disabled?: boolean;
}) {
  return (
    <div className="studio-image-actions">
      <button
        type="button"
        className="studio-preview-action"
        disabled={disabled || !!actions.job}
        onClick={() => void actions.run("copy")}
        title="Copy PNG image to clipboard"
      >
        {actions.job === "copy" ? (
          <LoaderCircle size={13} className="studio-spin" />
        ) : actions.message === "Copied" ? (
          <Check size={13} />
        ) : (
          <Copy size={13} />
        )}{" "}
        {actions.job === "copy"
          ? "Copying…"
          : actions.message === "Copied"
            ? "Copied"
            : "Copy"}
      </button>
      <button
        type="button"
        className="studio-preview-action"
        disabled={disabled || !!actions.job}
        onClick={() => void actions.run("export")}
        title="Download PNG image"
      >
        {actions.job === "export" ? (
          <LoaderCircle size={13} className="studio-spin" />
        ) : (
          <Download size={13} />
        )}{" "}
        {actions.job === "export" ? "Exporting…" : "Export PNG"}
      </button>
    </div>
  );
}
export function ImageFeedback({
  actions,
}: {
  actions: ReturnType<typeof useImageActions>;
}) {
  return (
    <>
      {actions.message && (
        <span className="studio-image-feedback" role="status">
          {actions.message}
        </span>
      )}
      {actions.failure && (
        <div className="studio-image-error" role="alert">
          <span>{actions.failure}</span>
          {actions.canExport && (
            <button
              type="button"
              disabled={!!actions.job}
              onClick={() => void actions.run("export")}
            >
              Export PNG
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss image error"
            onClick={actions.dismiss}
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}

export function InterfaceExportMenu({
  actions,
  figma,
  disabled,
}: {
  actions: ReturnType<typeof useImageActions>;
  figma: ReturnType<typeof useFigmaActions>;
  disabled: boolean;
}) {
  const working = !!actions.job || figma.state === "copying";
  const [portalHost, setPortalHost] = useState<Element | null>(null);
  useEffect(() => {
    const sync = () => setPortalHost(document.fullscreenElement);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="studio-export-trigger"
        disabled={disabled || working}
        aria-label="Export interface"
      >
        {working ? (
          <LoaderCircle size={13} className="studio-spin" />
        ) : (
          <Download size={13} />
        )}{" "}
        {working ? "Preparing…" : "Export"} <ChevronDown size={12} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalHost}>
        <DropdownMenu.Content
          className="studio-export-menu"
          align="end"
          sideOffset={5}
        >
          <DropdownMenu.Item
            className="studio-export-item"
            onSelect={() => void actions.run("copy")}
          >
            <Copy size={15} />
            Copy PNG
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="studio-export-item"
            onSelect={() => void actions.run("export")}
          >
            <Download size={15} />
            Export PNG
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="studio-export-divider" />
          <DropdownMenu.Item
            className="studio-export-item is-figma"
            onSelect={() => void figma.copy()}
          >
            <Layers2 size={16} />
            Copy for Figma
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

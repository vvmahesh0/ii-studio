"use client";
import { Check, LoaderCircle } from "lucide-react";
import { useWorkspace } from "./context";
export function WorkspaceSaveStatus() {
  const w = useWorkspace();
  const artifact = w.artifactFor(w.sessions[w.mode].key);
  if (!artifact && w.status === "saved" && !w.busy) return null;
  return (
    <span className={`workspace-save-status ${w.status}`} role="status">
      {w.busy ? (
        "Generating…"
      ) : w.status === "saving" || w.status === "loading" ? (
        <>
          <LoaderCircle size={12} className="studio-spin" /> Saving…
        </>
      ) : w.status === "error" ? (
        "Couldn't save locally"
      ) : (
        <>
          <Check size={12} /> Saved locally
        </>
      )}
    </span>
  );
}

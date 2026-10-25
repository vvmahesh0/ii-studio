"use client";
import { useRef, useState, useEffect } from "react";
import { Download, Upload } from "lucide-react";
import { useWorkspace } from "./context";
import { mergeBackup, validateBackup } from "../lib/workspace/backup";
import { validateGeneration } from "../lib/workspace/validation";
export function WorkspaceBackupActions({ disabled }: { disabled: boolean }) {
  const w = useWorkspace();
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const importing = useRef(false);
  useEffect(() => {
    if (importing.current && w.status === "saved") {
      importing.current = false;
      setMessage("Backup imported.");
      setBusy(false);
    }
    if (importing.current && w.status === "error") {
      importing.current = false;
      setMessage("Import could not be saved. Your existing work is unchanged.");
      setBusy(false);
    }
  }, [w.status]);
  async function exportBackup() {
    setBusy(true);
    setMessage("");
    try {
      if (!w.storage.current) throw new Error("Local storage is unavailable.");
      const b = validateBackup(await w.storage.current.backup());
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `ii-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't export backup.");
    } finally {
      setBusy(false);
    }
  }
  async function importFile(selected: File) {
    setBusy(true);
    setMessage("");
    try {
      if (selected.size > 25 * 1024 * 1024)
        throw new Error("Choose a backup smaller than 25 MB.");
      const incoming = validateBackup(JSON.parse(await selected.text()));
      for (const g of incoming.generations) await validateGeneration(g);
      if (!w.storage.current) throw new Error("Local storage is unavailable.");
      const existing = validateBackup(await w.storage.current.backup());
      const merged = mergeBackup(incoming, existing);
      importing.current = true;
      w.transact(async (tx) => {
        for (const p of merged.projects)
          await tx.objectStore("projects").add(p);
        for (const c of merged.conversations)
          await tx.objectStore("conversations").add(c);
        for (const a of merged.artifacts)
          await tx.objectStore("artifacts").add(a);
        for (const g of merged.generations)
          await tx.objectStore("generations").add(g);
        for (const doc of merged.working)
          await tx.objectStore("working").add(doc);
      });
    } catch (e) {
      importing.current = false;
      setMessage(
        e instanceof SyntaxError
          ? "This file isn't valid JSON. Choose a backup exported from II studio."
          : e instanceof Error && e.name === "ZodError"
            ? "This isn't a supported II studio backup. Choose an intact version 1 backup."
            : e instanceof Error
              ? e.message
              : "This backup could not be imported.",
      );
      setBusy(false);
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  return (
    <>
      <div className="workspace-backup-actions">
        <button disabled={disabled || busy} onClick={() => void exportBackup()}>
          <Download size={12} />
          Export backup
        </button>
        <button
          disabled={disabled || busy || w.status === "error"}
          onClick={() => file.current?.click()}
        >
          <Upload size={12} />
          Import backup
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) void importFile(e.target.files[0]);
        }}
      />
      {busy && <p role="status">Preparing backup…</p>}
      {message && <p role="status">{message}</p>}
    </>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { ClipboardUnavailableError, copyPng, downloadPng } from "../lib/image/png";
export function useImageActions(
  prepare: () => Promise<Blob>,
  title: string,
  filename?: string,
) {
  const [job, setJob] = useState<"copy" | "export" | null>(null),
    [message, setMessage] = useState(""),
    [failure, setFailure] = useState(""),
    [canExport, setCanExport] = useState(false);
  const running = useRef(false),
    mounted = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  async function run(kind: "copy" | "export") {
    if (running.current) return;
    running.current = true;
    if (timer.current) clearTimeout(timer.current);
    setJob(kind);
    setMessage("");
    setFailure("");
    setCanExport(false);
    try {
      if (kind === "copy") await copyPng(prepare);
      else downloadPng(await prepare(), title, filename);
      if (mounted.current) {
        setMessage(kind === "copy" ? "Copied" : "PNG exported");
        timer.current = setTimeout(() => {
          if (mounted.current) setMessage("");
        }, 2500);
      }
    } catch (e) {
      if (mounted.current) {
        setCanExport(e instanceof ClipboardUnavailableError);
        setFailure(
          e instanceof Error
            ? e.message
            : "The image could not be prepared. Try Export PNG.",
        );
      }
    } finally {
      running.current = false;
      if (mounted.current) setJob(null);
    }
  }
  return { job, message, failure, canExport, run, dismiss: () => setFailure("") };
}

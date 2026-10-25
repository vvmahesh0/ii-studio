"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { copyForFigma } from "../lib/figma/clipboard";
import type { SelectionInfo } from "../lib/openui/refinement/scope";
export function useFigmaActions({
  root,
  disabled,
  source,
  name,
  semantics,
  onBusyChange,
}: {
  root: RefObject<HTMLDivElement | null>;
  disabled: boolean;
  source: {
    library: "default" | "modern";
    artifactId?: string;
    generationId?: string;
  };
  name: string;
  semantics: Record<string, SelectionInfo>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const running = useRef(false),
    mounted = useRef(true);
  const current = useRef(source.generationId);
  useEffect(() => {
    current.current = source.generationId;
  }, [source.generationId]);
  const [metrics, setMetrics] = useState<Awaited<
    ReturnType<typeof copyForFigma>
  > | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(() => {
      setState("idle");
      setMessage("");
    }, 6000);
    return () => clearTimeout(timer);
  }, [state]);
  async function copy() {
    if (disabled || running.current || !root.current) return;
    const element = root.current,
      generation = source.generationId;
    running.current = true;
    setState("copying");
    setMessage("");
    onBusyChange?.(true);
    try {
      const metrics = await copyForFigma(async () => {
        const [{ extractDesign, reuseMetricCards }, { serializePayload }] =
          await Promise.all([
            import("../../tools/figma-adapter-poc/src/extractor"),
            import("../../tools/figma-adapter-poc/src/contract"),
          ]);
        if (
          current.current !== generation ||
          root.current !== element ||
          !element.isConnected
        )
          throw new Error(
            "The preview changed. Copy the selected version again.",
          );
        const result = await extractDesign(element, {
          source,
          name,
          semantics,
        });
        if (current.current !== generation || root.current !== element)
          throw new Error(
            "The preview changed. Copy the selected version again.",
          );
        return serializePayload(reuseMetricCards(result.document, false));
      });
      if (mounted.current) {
        setState("copied");
        setMessage(
          "Copied for Figma. Press ⌘V in the II studio plugin to add your design to the canvas.",
        );
        // Local diagnostic timings only; no telemetry or workspace writes.
        setMetrics(metrics);
      }
    } catch (error) {
      if (mounted.current) {
        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "The design could not be copied.",
        );
      }
    } finally {
      running.current = false;
      if (mounted.current) {
        onBusyChange?.(false);
      }
    }
  }
  return {
    state,
    message,
    metrics,
    copy,
    dismiss: () => {
      setMessage("");
      setState("idle");
    },
  };
}
export function FigmaFeedback({
  actions,
}: {
  actions: ReturnType<typeof useFigmaActions>;
}) {
  return actions.message ? (
    <div
      className="studio-figma-feedback"
      role={actions.state === "error" ? "alert" : "status"}
      data-figma-copy-metrics={
        actions.metrics ? JSON.stringify(actions.metrics) : undefined
      }
    >
      <span>
        {actions.message}{" "}
        <a href="/downloads/ii-studio-figma-plugin.zip" download>
          Get plugin
        </a>
      </span>
      <button
        type="button"
        aria-label="Dismiss Figma message"
        onClick={actions.dismiss}
      >
        Dismiss
      </button>
    </div>
  ) : null;
}

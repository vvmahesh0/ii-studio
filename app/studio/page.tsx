"use client";
import { SmoothTabs } from "./smooth-tabs";
import { generationFetch } from "../lib/model/client";
import { MAX_PROMPT_CHARACTERS } from "../lib/prompt-limits";
import {
  normalizeSelectionProgram,
  selectionIndex,
  type SelectionInfo,
} from "../lib/openui/refinement/scope";
import { selectionLibrary } from "./selection-library";
import { SelectionOverlay } from "./selection-overlay";

import { localTitle } from "../lib/workspace/model";

import dynamic from "next/dynamic";
import { flushSync } from "react-dom";
import {
  Component,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type ComponentProps,
} from "react";
import {
  ArrowUp,
  PanelTop,
  ArrowDown,
  ArrowRight,
  Check,
  LayoutGrid,
  MousePointer2,
  Workflow,
  RotateCcw,
  Square,
  WandSparkles,
  X,
} from "lucide-react";
import {
  Renderer,
  type OpenUIError,
  type ParseResult,
  type Library,
} from "@openuidev/react-lang";
import {
  defaultLibrary,
  loadThemeLibrary,
} from "@/app/lib/openui/themes/client";
import { themeInfo, type ThemeId } from "@/app/lib/openui/themes/types";
import { ModernBoundary } from "@/app/lib/openui/modern/portal";
import "@/app/lib/openui/modern/theme.css";
import { starters, modernStarters } from "@/app/lib/openui/examples";
import {
  StudioHeader,
  CanvasWaiting,
  VersionMenu,
  PreviewActions,
} from "./components";
import { useImageActions } from "./use-image-actions";
import { InterfaceExportMenu, ImageFeedback } from "./image-actions";
import { useFigmaActions, FigmaFeedback } from "./figma-actions";
import { usePreviewFullscreen } from "./use-preview-fullscreen";
import { interfaceTitle } from "./interface-title";
import { cleanProgram, hasUsefulContent } from "@/app/lib/openui/protocol";
import "@/app/lib/openui/components/theme.css";
import "@/app/lib/openui/components/components.css";
import "./studio.css";
import { WorkspaceProvider, useWorkspace } from "../workspace/context";
import {
  WorkspaceNavigation,
  WorkspaceContextBar,
  InstructionContext,
} from "../workspace/navigation";
import "../workspace/workspace.css";

type Version = {
  storageId: string;
  theme: ThemeId;
  revision: string;
  id: number;
  prompt: string;
  title: string;
  program: string;
  firstUiMs: number;
  elapsedMs: number;
  state: Record<string, unknown>;
  refinement?: {
    kind: "selection";
    targetId: string;
    component: string;
    parentId?: string;
  };
};
type Connection = "connecting" | "ready" | "failed";
type GenerationEvent = {
  theme?: ThemeId;
  revision?: string;
  type: string;
  delta?: string;
  program?: string;
  error?: string;
  details?: string[];
  elapsedMs?: number;
  reconnect?: boolean;
};

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const nextPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

class PreviewBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? (
      <div className="studio-render-failure">
        This preview could not be displayed. Your previous versions are still
        available.
      </div>
    ) : (
      this.props.children
    );
  }
}

/** Restore a version once per mount; typing must not reinitialize its store. */
function StableRenderer(props: ComponentProps<typeof Renderer>) {
  const [initialState] = useState(props.initialState);
  return <Renderer {...props} initialState={initialState} />;
}

function ThemeBoundary({
  theme,
  children,
}: {
  theme: ThemeId;
  children: ReactNode;
}) {
  return theme === "modern" ? (
    <ModernBoundary>{children}</ModernBoundary>
  ) : (
    <>{children}</>
  );
}

function InterfaceStudio({
  modeControls,
  onBusyChange,
}: {
  modeControls: ReactNode;
  onBusyChange: (busy: boolean) => void;
}) {
  const workspace = useWorkspace();
  const session = workspace.sessions.interface;
  const seed = session.loaded;
  const initialVersions: Version[] = (seed?.generations ?? []).flatMap((g) =>
    g.type === "interface"
      ? [
          {
            storageId: g.id,
            id: g.version,
            theme: g.theme,
            revision: g.revision,
            prompt: g.instruction,
            title: seed!.artifact.title,
            program: g.program,
            refinement: g.refinement,
            firstUiMs: 0,
            elapsedMs: 0,
            state: {},
          },
        ]
      : [],
  );
  const activeSeed = initialVersions.find(
    (v) => v.storageId === seed?.artifact.activeGenerationId,
  );
  const { previewRef, expanded, toggle } = usePreviewFullscreen();
  const [fullscreenWidth, setFullscreenWidth] = useState<number | null>(null);
  const streamTitle = useRef<string | null>(null);
  const [theme, setTheme] = useState<ThemeId>(
    activeSeed?.theme ?? session.theme ?? "default",
  );
  const [libraries, setLibraries] = useState<Partial<Record<ThemeId, Library>>>(
    { default: defaultLibrary },
  );
  const connectionAttempt = useRef(0);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [prompt, setPrompt] = useState(session.draft ?? "");
  const [versions, setVersions] = useState<Version[]>(initialVersions);
  const [selectedId, setSelectedId] = useState<number | null>(
    activeSeed?.id ?? null,
  );
  const [selectMode, setSelectMode] = useState(false);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [targeting, setTargeting] = useState(false);
  const [selectionModeContext, setSelectionModeContext] = useState(
    workspace.mode,
  );
  // Both studios stay mounted to retain drafts. Reset only transient selection
  // on a mode transition, before committing children, without remounting them.
  if (selectionModeContext !== workspace.mode) {
    setSelectionModeContext(workspace.mode);
    setSelectMode(false);
    setSelectionId(null);
  }
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingProgram, setStreamingProgram] = useState<string | null>(null);
  const [streamHasContent, setStreamHasContent] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const firstPaint = useRef<number | null>(null);
  const paintScheduled = useRef(false);
  useEffect(() => {
    onBusyChange(isGenerating);
  }, [isGenerating, onBusyChange]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [details, setDetails] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [renderIssues, setRenderIssues] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const startedAt = useRef<number | null>(null);
  const pendingPaint = useRef<{ id: number; start: number } | null>(null);
  const versionCounter = useRef(
    Math.max(0, ...initialVersions.map((v) => v.id)),
  );
  const lastRequest = useRef<{
    prompt: string;
    previous: string;
    theme: ThemeId;
    target?: SelectionInfo;
  } | null>(null);
  const selected = versions.find((version) => version.id === selectedId);
  const baseLibrary = libraries[theme];
  const library = useMemo(
    () => (baseLibrary ? selectionLibrary(baseLibrary) : undefined),
    [baseLibrary],
  );
  const selectedProgram = selected?.program ?? "";
  const completedProgram = useMemo(() => {
    if (!selectedProgram || !baseLibrary) return selectedProgram;
    try {
      return normalizeSelectionProgram(
        selectedProgram,
        Object.keys(baseLibrary.components),
      );
    } catch {
      return selectedProgram;
    }
  }, [selectedProgram, baseLibrary]);
  const selections = useMemo(() => {
    if (!baseLibrary || !completedProgram) return {};
    try {
      return selectionIndex(
        completedProgram,
        Object.keys(baseLibrary.components),
      );
    } catch {
      return {};
    }
  }, [completedProgram, baseLibrary]);
  const selection = selectionId ? selections[selectionId] : undefined;
  const program = streamingProgram ?? completedProgram;
  const clearSelection = useCallback(() => setSelectionId(null), []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy.current) {
        setSelectionId(null);
        setSelectMode(false);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const captureRef = useRef<HTMLDivElement>(null);
  const [figmaCopying, setFigmaCopying] = useState(false);
  const images = useImageActions(
    async () => {
      if (!captureRef.current || busy.current || !selected)
        throw new Error("Open a completed interface before capturing.");
      const { captureInterface } = await import(
        "../lib/image/interface-capture"
      );
      return captureInterface(captureRef.current);
    },
    workspace.artifactFor(session.key)?.title ?? selected?.title ?? "Interface",
  );

  const figma = useFigmaActions({
    root: captureRef,
    disabled: !selected || !library || isGenerating || !!images.job || !!renderIssues.length,
    source: {library:theme, artifactId:workspace.artifactFor(session.key)?.id, generationId:selected?.storageId},
    name:workspace.artifactFor(session.key)?.title ?? selected?.title ?? "Interface",
    semantics:selections,
    onBusyChange:setFigmaCopying,
  });

  const connect = useCallback(async () => {
    const attempt = ++connectionAttempt.current;
    setConnection("connecting");
    try {
      const [loaded, response] = await Promise.all([
        loadThemeLibrary(theme).then((loaded) => {
          if (attempt === connectionAttempt.current)
            setLibraries((previous) => ({ ...previous, [theme]: loaded }));
          return loaded;
        }),
        fetch("/api/openui/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme }),
        }),
      ]);
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not connect to the model.");
      if (attempt !== connectionAttempt.current) return;
      setLibraries((previous) => ({ ...previous, [theme]: loaded }));
      setConnection("ready");
    } catch (caught) {
      if (attempt !== connectionAttempt.current) return;
      setConnection("failed");
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not connect to the model.",
      );
    }
  }, [theme]);

  useEffect(() => {
    const changed = () => { void connect(); };
    window.addEventListener("ii-model-change", changed);
    return () => window.removeEventListener("ii-model-change", changed);
  }, [connect]);

  useEffect(() => {
    void Promise.resolve().then(connect);
    return () => controller.current?.abort();
  }, [connect]);
  useEffect(() => {
    if (!isGenerating) return;
    const timer = window.setInterval(() => {
      if (startedAt.current !== null)
        setElapsed(performance.now() - startedAt.current);
    }, 100);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  const onParseResult = useCallback(
    (result: ParseResult | null) => {
      const title = interfaceTitle(result?.root);
      if (title) {
        if (busy.current) streamTitle.current = title;
        else if (selectedId !== null)
          setVersions((vs) => {
            if (vs.find((v) => v.id === selectedId)?.title === title) return vs;
            return vs.map((v) => (v.id === selectedId ? { ...v, title } : v));
          });
      }
      if (
        !busy.current ||
        (targeting && !streamHasContent) ||
        !hasUsefulContent(result?.root, 300, theme)
      )
        return;
      setStreamHasContent(true);
      if (
        firstPaint.current !== null ||
        paintScheduled.current ||
        startedAt.current === null
      )
        return;
      paintScheduled.current = true;
      const start = startedAt.current;
      void nextPaint().then(() => {
        if (
          busy.current &&
          startedAt.current === start &&
          firstPaint.current === null
        ) {
          firstPaint.current = performance.now() - start;
        }
        if (startedAt.current === start) paintScheduled.current = false;
      });
    },
    [theme, selectedId, targeting, streamHasContent],
  );

  // Keep first-visible-content timing separate from the completed preview paint.
  useEffect(() => {
    const pending = pendingPaint.current;
    if (isGenerating || !pending || pending.id !== selectedId || !library)
      return;
    let active = true;
    void nextPaint().then(() => {
      if (!active || pendingPaint.current !== pending) return;
      const visibleMs = performance.now() - pending.start;
      pendingPaint.current = null;
      setVersions((vs) =>
        vs.map((v) =>
          v.id === pending.id
            ? {
                ...v,
                firstUiMs: firstPaint.current ?? visibleMs,
                elapsedMs: visibleMs,
              }
            : v,
        ),
      );
    });
    return () => {
      active = false;
    };
  }, [isGenerating, selectedId, library]);

  const onRenderErrors = useCallback((issues: OpenUIError[]) => {
    if (busy.current) return;
    const messages = issues
      .filter((issue) => issue.severity !== "warning")
      .map((issue) => issue.message);
    setRenderIssues((previous) =>
      JSON.stringify(previous) === JSON.stringify(messages)
        ? previous
        : messages,
    );
  }, []);

  const onPreviewFailure = useCallback(() => {
    if (!busy.current)
      setError(
        "The generated widget could not be rendered. Try again or select an earlier version.",
      );
  }, []);

  const onAction = useCallback(() => {
    // Local component state still updates through the renderer. Unconnected
    // assistant/backend actions have no visible receipt in this UI preview.
  }, []);

  const onStateUpdate = useCallback(
    (state: Record<string, unknown>) => {
      if (busy.current || selectedId === null) return;
      setVersions((previous) =>
        previous.map((version) =>
          version.id === selectedId &&
          JSON.stringify(version.state) !== JSON.stringify(state)
            ? { ...version, state }
            : version,
        ),
      );
    },
    [selectedId],
  );

  async function generate(
    description = prompt,
    priorProgram = selected?.theme === theme ? selected.program : "",
    target: SelectionInfo | undefined = selection,
  ) {
    if (busy.current) return;
    if (description.trim().length < 4) {
      setError("Describe the widget you want to create first.");
      return;
    }
    if (connection !== "ready") {
      setError("Wait for the model connection, then generate your interface.");
      return;
    }
    if (
      !target &&
      selected &&
      description.trim() === selected.prompt &&
      priorProgram
    ) {
      setError(
        "Enter a change for this version, or use Clear to create something different.",
      );
      return;
    }
    if (selectMode && !target) {
      setError(
        "Select a component, or switch to Preview to refine the whole interface.",
      );
      return;
    }
    if (target && !target.safe) {
      setError(
        "This component is reused. Select its containing section instead.",
      );
      return;
    }
    if (target) {
      priorProgram = completedProgram;
      setSelectionId(target.id);
      setSelectMode(true);
    }
    busy.current = true;
    setTargeting(!!target);
    controller.current = new AbortController();
    lastRequest.current = {
      prompt: description.trim(),
      previous: priorProgram,
      theme,
      target,
    };
    startedAt.current = performance.now();
    pendingPaint.current = null;
    firstPaint.current = null;
    paintScheduled.current = false;
    streamTitle.current = null;
    setStreamHasContent(false);
    setStreamingProgram(target ? priorProgram : "");
    setStreamKey((key) => key + 1);
    setCanRetry(true);
    setElapsed(0);
    setIsGenerating(true);
    setError("");
    setDetails([]);
    setNotice("");
    setRenderIssues([]);
    let completed = false;
    let accumulated = "";
    try {
      const response = await generationFetch(
        target ? "/api/openui/refine" : "/api/openui/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: description.trim(),
            previous: priorProgram,
            target: target?.id,
            theme,
            revision: themeInfo[theme].revision,
            previousTheme: priorProgram ? theme : undefined,
          }),
          signal: controller.current.signal,
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Generation failed.");
      }
      if (!response.body)
        throw new Error("The generation stream was empty. Please retry.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!data) continue;
          const event = JSON.parse(data.slice(6)) as GenerationEvent;
          if (event.type === "reset") {
            accumulated = "";
            setStreamingProgram(target ? priorProgram : "");
            setStreamHasContent(!!target);
            if (!target) setStreamKey((key) => key + 1);
          }
          if (target && event.type === "preview" && event.program) {
            setStreamingProgram(event.program);
            setStreamHasContent(true);
          }
          if (!target && event.type === "delta") {
            accumulated += event.delta ?? "";
            setStreamingProgram(cleanProgram(accumulated));
          }
          if (event.type === "error" || event.type === "invalid") {
            setDetails(event.details ?? []);
            if (event.reconnect) setConnection("failed");
            throw new Error(
              event.error || "The widget could not be completed.",
            );
          }
          if (event.type === "complete" && event.program) {
            if (
              event.theme !== theme ||
              event.revision !== themeInfo[theme].revision
            )
              throw new Error(
                "The generated interface used a different theme. Please try again.",
              );
            setNotice("");
            setRenderIssues([]);
            setStreamingProgram(event.program);
            const total =
              performance.now() - (startedAt.current ?? performance.now());
            const version: Version = {
              theme,
              revision: themeInfo[theme].revision,
              id: ++versionCounter.current,
              storageId: crypto.randomUUID(),
              prompt: description.trim(),
              title: target
                ? (selected?.title ?? "Interface")
                : (streamTitle.current ?? "Interface"),
              program: event.program,
              firstUiMs: firstPaint.current ?? total,
              elapsedMs: total,
              state: target ? { ...selected?.state } : {},
              ...(target
                ? {
                    refinement: {
                      kind: "selection" as const,
                      targetId: target.id,
                      component: target.type,
                      ...(target.parentId ? { parentId: target.parentId } : {}),
                    },
                  }
                : {}),
            };
            pendingPaint.current = {
              id: version.id,
              start: startedAt.current ?? performance.now(),
            };
            setVersions((previous) => [version, ...previous]);
            workspace.complete({
              sessionKey: session.key,
              id: version.storageId,
              version: version.id,
              parentId: priorProgram ? (selected?.storageId ?? null) : null,
              instruction: description.trim(),
              title: version.title,
              content: {
                type: "interface",
                theme,
                revision: version.revision,
                program: version.program,
                refinement: version.refinement,
              },
            });
            setSelectedId(version.id);
            clearSelection();
            setSelectMode(false);
            setElapsed(total);
            completed = true;
          }
        }
        if (done) break;
      }
      if (!completed)
        throw new Error(
          "The stream ended before the widget was complete. Please retry.",
        );
    } catch (caught) {
      if (controller.current?.signal.aborted) {
        setNotice(
          "Generation stopped. Your earlier versions are still available.",
        );
        void connect();
      } else
        setError(
          caught instanceof Error
            ? caught.message
            : "Generation failed. Please retry.",
        );
    } finally {
      busy.current = false;
      setIsGenerating(false);
      setStreamingProgram(null);
      controller.current = null;
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (prompt.trim()) void generate();
  }

  return (
    <main className="studio" data-theme="light">
      <StudioHeader
        modeControls={modeControls}
        connection={connection}
        preparing={`Preparing ${themeInfo[theme].label}…`}
        reconnect={() => {
          setError("");
          void connect();
        }}
      />

      <div className="studio-workspace">
        <WorkspaceContextBar />
        <section className="studio-intro">
          <h1>Describe your idea of interface</h1>
        </section>

        {selected && (
          <InstructionContext
            instruction={selected.prompt}
            original={
              workspace.artifactFor(session.key)?.originalPrompt ??
              selected.prompt
            }
          />
        )}
        <form className={`studio-composer ${selection ? "has-selection" : ""}`} onSubmit={submit}>
          {selection && (
            <div className="studio-selection-context">
              <span className="studio-selected-chip">
                <PanelTop size={13} /> Selected: <strong>{selection.label}</strong>
              </span>
              {selection.parentId && (
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setSelectionId(selection.parentId!)}
                >
                  <ArrowUp size={13} /> Select parent
                </button>
              )}
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => {
                  clearSelection();
                  setSelectMode(false);
                }}
              >
                <X size={13} /> Clear selection
              </button>
              <span className="studio-scope-badge">● Scoped to {selection.label}</span>
            </div>
          )}
          <label htmlFor="widget-prompt" className="studio-sr-only">
            Describe your widget or refinement
          </label>
          <textarea
            id="widget-prompt"
            disabled={isGenerating}
            rows={2}
            maxLength={MAX_PROMPT_CHARACTERS}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (prompt.trim()) void generate();
              }
            }}
            placeholder={
              selection
                ? "Describe the change to this selection…"
                : selected
                  ? "What would you change? Add a plan, change the figures, simplify the layout…"
                  : "A pricing section for a project management app, with three plans…"
            }
          />
          <div className="studio-composer-bottom">
            <SmoothTabs className="studio-theme-toggle" label="Theme">
              {(["modern", "default"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={theme === value}
                  disabled={isGenerating || workspace.status !== "saved"}
                  onClick={() => {
                    if (theme === value) return;
                    workspace.clear("interface", value, prompt);
                  }}
                >
                  {themeInfo[value].label}
                </button>
              ))}
            </SmoothTabs>
            <span className="studio-composer-spacer" />
            <span className="studio-character-count" title="Characters, including spaces">
              {prompt.length.toLocaleString()} / {MAX_PROMPT_CHARACTERS.toLocaleString()}
            </span>
            {isGenerating ? (
              <button
                className="studio-generate studio-stop"
                type="button"
                onClick={() => controller.current?.abort()}
              >
                <Square size={13} fill="currentColor" />
                Stop generation · {seconds(elapsed)}
              </button>
            ) : (
              <button
                className="studio-generate"
                type="submit"
                disabled={
                  !prompt.trim() || connection !== "ready" || workspace.status === "error"
                }
              >
                <WandSparkles size={16} />
                {selection
                  ? "Refine selection"
                  : selected
                    ? "Refine UI"
                    : "Generate UI"}
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </form>

        <div className="studio-starters" hidden={isGenerating}>
          <span>Try these interfaces:</span>
          {(theme === "modern" ? modernStarters : starters).map((starter) => (
            <button
              key={starter.id}
              disabled={isGenerating}
              onClick={() => {
                setPrompt(starter.prompt);
                if (selected)
                  setNotice(
                    "Use Clear to start a separate interface, or describe a change to refine this one.",
                  );
                setError("");
              }}
            >
              {starter.label}
              <ArrowDown size={11} />
            </button>
          ))}
        </div>

        {notice && (
          <div className="studio-notice" role="status">
            <Check size={15} />
            <span>{notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {!isGenerating && renderIssues.length > 0 && (
          <div className="studio-error" role="alert">
            <div>
              <strong>Some components need attention.</strong>
              <p>
                Your saved versions are still available. Refine this widget or
                retry the request.
              </p>
              <details>
                <summary>Preview details</summary>
                <ul>
                  {renderIssues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        )}

        <section
          ref={previewRef}
          className={`studio-result ${expanded ? "studio-preview-fullscreen" : ""}`}
          aria-label="Widget preview"
          data-first-ui-ms={selected?.firstUiMs}
          data-completion-ms={selected?.elapsedMs}
          aria-busy={isGenerating}
        >
          <div className="studio-result-toolbar">
            <div className="studio-preview-heading">
              <LayoutGrid size={14} aria-hidden="true" />
              {selected && (
                <SmoothTabs className="studio-theme-toggle studio-selection-toggle" label="Preview interaction">
                  <button
                    type="button"
                    aria-pressed={!selectMode}
                    disabled={isGenerating}
                    onClick={() => {
                      setSelectMode(false);
                      clearSelection();
                    }}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    aria-pressed={selectMode}
                    disabled={isGenerating || !library}
                    onClick={() => {
                      setSelectMode(true);
                      setError("");
                    }}
                  >
                    <MousePointer2 size={13} /> Select to refine
                  </button>
                </SmoothTabs>
              )}
            </div>
            <div className="studio-canvas-tools">
              {isGenerating && (
                <span className="studio-preview-label" role="status">
                  Generating…
                </span>
              )}
              {expanded && selection && (
                <button
                  type="button"
                  className="studio-preview-action"
                  disabled={isGenerating}
                  onClick={async () => {
                    await toggle();
                    document.getElementById("widget-prompt")?.focus();
                  }}
                >
                  Describe change
                </button>
              )}
              <InterfaceExportMenu actions={images} figma={figma} disabled={!selected || !library || isGenerating || figmaCopying || !!renderIssues.length}/>
              <PreviewActions
                expanded={expanded}
                onFullscreen={() => {
                  if (!expanded) setFullscreenWidth(captureRef.current?.getBoundingClientRect().width ?? null);
                  void toggle();
                }}
                disabled={isGenerating || workspace.status !== "saved"}
                onClear={() => {
                  workspace.clear("interface", theme);
                }}
              />
            </div>
          </div>

          <ImageFeedback actions={images} />
          <FigmaFeedback actions={figma}/>
          {error && (
            <div className="studio-failure-overlay">
              <div className="studio-error" role="alert">
                <div>
                  <strong>We couldn’t finish that.</strong>
                  <p>{error}</p>
                  {details.length > 0 && (
                    <details>
                      <summary>Generation details</summary>
                      <ul>
                        {details.map((detail, index) => (
                          <li key={index}>{detail}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                <div className="studio-error-actions">
                  {connection === "ready" && canRetry && (
                    <button
                      onClick={() => {
                        const request = lastRequest.current;
                        if (request && request.theme === theme)
                          void generate(
                            request.prompt,
                            request.previous,
                            request.target,
                          );
                      }}
                      disabled={isGenerating}
                    >
                      <RotateCcw size={13} />
                      Retry
                    </button>
                  )}
                  {selected && (
                    <button onClick={() => setError("")}>
                      Return to previous version
                    </button>
                  )}
                  <button
                    aria-label="Dismiss error"
                    onClick={() => setError("")}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="studio-canvas">
            {!program ? (
              <CanvasWaiting
                mode="interface"
                busy={isGenerating}
                elapsed={elapsed}
              />
            ) : !library ? (
              <CanvasWaiting mode="interface" busy />
            ) : (
              <>
                {isGenerating && !targeting && !streamHasContent && (
                  <CanvasWaiting mode="interface" busy elapsed={elapsed} />
                )}
                <div
                  className="studio-preview"
                  ref={captureRef}
                  style={expanded && fullscreenWidth ? { width: fullscreenWidth, maxWidth: "none", flexShrink: 0 } : undefined}
                  hidden={isGenerating && !targeting && !streamHasContent}
                  data-select-mode={selectMode || undefined}
                >
                  <PreviewBoundary
                    key={
                      isGenerating && !targeting
                        ? `stream-${streamKey}`
                        : (selected?.id ?? "empty")
                    }
                    onFailure={onPreviewFailure}
                  >
                    <ThemeBoundary theme={theme}>
                      <StableRenderer
                        key={
                          isGenerating && !targeting
                            ? `stream-${streamKey}`
                            : (selected?.id ?? "empty")
                        }
                        library={library}
                        response={program}
                        isStreaming={isGenerating}
                        onParseResult={onParseResult}
                        onAction={onAction}
                        onError={onRenderErrors}
                        onStateUpdate={onStateUpdate}
                        initialState={
                          isGenerating && !targeting
                            ? undefined
                            : selected?.state
                        }
                        publishObservability={false}
                      />
                    </ThemeBoundary>
                  </PreviewBoundary>
                </div>
              </>
            )}
          </div>
          <SelectionOverlay
            root={captureRef}
            enabled={selectMode}
            busy={isGenerating}
            index={selections}
            selected={selectionId}
            onSelect={setSelectionId}
          />
        </section>
      </div>
      <footer className="studio-statusbar">
        <VersionMenu
          items={versions.map((v) => ({
            id: v.id,
            label: `v${v.id} · ${localTitle(workspace.artifactFor(session.key)?.title ?? v.title)}`,
            description: v.refinement
              ? `${v.refinement.component}: ${v.prompt}`
              : v.prompt,
          }))}
          selectedId={selectedId}
          disabled={isGenerating}
          onSelect={(id) => {
            const version = versions.find((v) => v.id === id);
            if (!version) return;
            clearSelection();
            setSelectMode(false);
            setTheme(version.theme);
            if (version.theme !== theme) setConnection("connecting");
            setSelectedId(id);
            setPrompt("");
            const artifact = workspace.artifactFor(session.key);
            if (artifact)
              workspace.selectVersion(artifact.id, version.storageId);
            setRenderIssues([]);
            setCanRetry(false);
            setError("");
            setNotice("");
          }}
        />
      </footer>
    </main>
  );
}

const FlowStudio = dynamic(() => import("../flowchart/studio"), { ssr: false });
function WorkspaceStudio() {
  const workspace = useWorkspace();
  const { mode, busy, setBusy } = workspace;
  const [visited, setVisited] = useState(false);
  const locked =
    busy || workspace.status === "loading" || workspace.status === "error";
  const switchMode = (next: "interface" | "flowchart") => {
    if (next === mode) return;
    if (next === "flowchart") setVisited(true);
    // Snapshot both pages for a true crossfade; keep existing mounted state.
    if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(() => flushSync(() => workspace.setMode(next)));
    } else workspace.setMode(next);
  };
  const controls = (
    <SmoothTabs className="studio-mode-switch" label="Studio mode">
      <button
        aria-pressed={mode === "interface"}
        disabled={locked}
        onClick={() => { switchMode("interface"); }}
      >
        <LayoutGrid size={13} /> Interface
      </button>
      <button
        aria-pressed={mode === "flowchart"}
        disabled={locked}
        onClick={() => {
          switchMode("flowchart");
        }}
      >
        <Workflow size={13} /> Flowchart
      </button>
    </SmoothTabs>
  );
  return (
    <>
      <WorkspaceNavigation />
      {workspace.status !== "loading" ? (
        <>
          <div className="studio-mode-panel" data-direction="left" hidden={mode !== "interface"}>
            <InterfaceStudio
              key={workspace.sessions.interface.key}
              modeControls={controls}
              onBusyChange={setBusy}
            />
          </div>
          {(visited ||
            mode === "flowchart" ||
            workspace.sessions.flowchart.loaded) && (
            <div className="studio-mode-panel" data-direction="right" hidden={mode !== "flowchart"}>
              <FlowStudio
                key={workspace.sessions.flowchart.key}
                modeControls={controls}
                onBusyChange={setBusy}
              />
            </div>
          )}
        </>
      ) : (
        <main className="studio">
          <div className="workspace-initializing" role="status">
            Opening your workspace…
          </div>
        </main>
      )}
    </>
  );
}
export default function Studio() {
  return (
    <WorkspaceProvider>
      <WorkspaceStudio />
    </WorkspaceProvider>
  );
}

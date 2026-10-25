"use client";
import { generationFetch } from "../lib/model/client";
import { MAX_PROMPT_CHARACTERS } from "../lib/prompt-limits";
import { localTitle } from "../lib/workspace/model";
import dynamic from "next/dynamic";
import { RadioGroup } from "radix-ui";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Square,
  WandSparkles,
  X,
  RotateCcw,
  Workflow,
} from "lucide-react";
import {
  StudioHeader,
  CanvasWaiting,
  StudioDialog,
  VersionMenu,
  PreviewActions,
} from "../studio/components";
import {
  diagramSchema,
  FLOW_REVISION,
  topology,
  type FlowSnapshot,
  type Clarification,
} from "../lib/flowchart/contract";
import { commit, undo, redo, type EditHistory } from "../lib/flowchart/history";
import { layoutDiagram, prepareLayout } from "../lib/flowchart/auto-layout";
import { usePreviewFullscreen } from "../studio/use-preview-fullscreen";
import { flowStarters } from "../lib/flowchart/examples";
import "./flowchart.css";
import { useWorkspace } from "../workspace/context";
import {
  WorkspaceContextBar,
  InstructionContext,
} from "../workspace/navigation";
const Editor = dynamic(() => import("./editor"), {
  ssr: false,
  loading: () => <div className="flow-empty">Loading the diagram editor…</div>,
});
type Metrics = {
  firstUiMs: number | null;
  firstTextMs: number | null;
  firstGraphMs: number | null;
  layoutMs: number;
  elapsedMs: number;
  corrections: number;
};
type Version = {
  storageId: string;
  clarification?: { question: string; answer: string };
  id: number;
  prompt: string;
  history: EditHistory;
  metrics: Metrics;
};
const seconds = (n: number | null) =>
  n === null ? "—" : `${(n / 1000).toFixed(1)}s`;
export default function FlowStudio({
  modeControls,
  onBusyChange,
}: {
  modeControls: ReactNode;
  onBusyChange: (busy: boolean) => void;
}) {
  const workspace = useWorkspace();
  const session = workspace.sessions.flowchart;
  const seed = session.loaded;
  const initialVersions: Version[] = (seed?.generations ?? []).flatMap((g) =>
    g.type === "flowchart"
      ? [
          {
            storageId: g.id,
            clarification: g.clarification,
            id: g.version,
            prompt: g.instruction,
            history: {
              past: [],
              present:
                seed?.working.find((w) => w.generationId === g.id)?.snapshot ??
                g.snapshot,
              future: [],
            },
            metrics: {
              firstUiMs: null,
              firstTextMs: null,
              firstGraphMs: null,
              layoutMs: 0,
              elapsedMs: 0,
              corrections: 0,
            },
          },
        ]
      : [],
  );
  const activeSeed = initialVersions.find(
    (v) => v.storageId === seed?.artifact.activeGenerationId,
  );
  const { previewRef, expanded, toggle } = usePreviewFullscreen();
  const [prompt, setPrompt] = useState(""),
    [versions, setVersions] = useState<Version[]>(initialVersions),
    [selectedId, setSelectedId] = useState<number | null>(
      activeSeed?.id ?? null,
    );
  const [connection, setConnection] = useState<
    "connecting" | "ready" | "failed"
  >("connecting");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [pending, setPending] = useState<
      (Clarification & { basePrompt: string }) | null
    >(null),
    [answer, setAnswer] = useState("");
  const [questionOpen, setQuestionOpen] = useState(false);
  const [customAnswer, setCustomAnswer] = useState(false);
  const [provisional, setProvisional] = useState<FlowSnapshot | null>(null);
  const firstPaint = useRef<number | null>(null);
  const pendingPaint = useRef<{ id: number; start: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const controller = useRef<AbortController | null>(null),
    counter = useRef(Math.max(0, ...initialVersions.map((v) => v.id))),
    isBusy = useRef(false),
    generation = useRef(0),
    started = useRef(0);
  const selected = versions.find((v) => v.id === selectedId),
    snapshot = busy ? provisional : (selected?.history.present ?? null);
  const connect = useCallback(async () => {
    setConnection("connecting");
    try {
      await Promise.all([
        import("./editor"),
        Promise.resolve().then(() => prepareLayout()),
      ]);
      const response = await fetch("/api/flowchart/status", { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.ready)
        throw new Error(body.error || "Could not connect to the model.");
      setConnection("ready");
    } catch (e) {
      setConnection("failed");
      setError(e instanceof Error ? e.message : "Could not connect.");
    }
  }, []);
  useEffect(() => { const changed=()=>{void connect();}; window.addEventListener("ii-model-change",changed); return ()=>window.removeEventListener("ii-model-change",changed); },[connect]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void connect();
    });
    return () => {
      cancelAnimationFrame(frame);
      controller.current?.abort();
    };
  }, [connect]);
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(
      () => setElapsed(performance.now() - started.current),
      100,
    );
    return () => clearInterval(timer);
  }, [busy]);
  function update(next: FlowSnapshot, before?: FlowSnapshot) {
    if (isBusy.current) return;
    if (selected) workspace.saveWorking(selected.storageId, next);
    setVersions((vs) =>
      vs.map((v) =>
        v.id === selectedId
          ? {
              ...v,
              history: commit(
                before ? { ...v.history, present: before } : v.history,
                next,
              ),
            }
          : v,
      ),
    );
  }
  function transient(
    next: Partial<Pick<FlowSnapshot, "positions" | "viewport">>,
  ) {
    if (isBusy.current) return;
    if (next.viewport && selected)
      workspace.saveWorking(selected.storageId, {
        ...selected.history.present,
        ...next,
      });
    setVersions((vs) =>
      vs.map((v) =>
        v.id === selectedId
          ? {
              ...v,
              history: {
                ...v.history,
                present: { ...v.history.present, ...next },
              },
            }
          : v,
      ),
    );
  }
  function travel(action: typeof undo) {
    if (selected)
      workspace.saveWorking(
        selected.storageId,
        action(selected.history).present,
      );
    setVersions((vs) =>
      vs.map((v) =>
        v.id === selectedId ? { ...v, history: action(v.history) } : v,
      ),
    );
  }
  const lastClarifiedRequest = useRef<{
    basePrompt: string;
    question: string;
    answer: string;
  } | null>(null);
  async function generate(responseAnswer?: string, retry = false) {
    if (isBusy.current || connection !== "ready") return;
    const clarification =
      responseAnswer && pending
        ? {
            basePrompt: pending.basePrompt,
            question: pending.question,
            answer: responseAnswer,
          }
        : retry
          ? lastClarifiedRequest.current
          : null;
    const requirement = clarification?.basePrompt ?? prompt.trim();
    if (requirement.length < 4) {
      setError("Describe your process in at least four characters.");
      return;
    }
    if (
      !responseAnswer &&
      !retry &&
      selected &&
      requirement === selected.prompt
    ) {
      setError(
        "Enter a change for this version, or use Clear to create something different.",
      );
      return;
    }
    const previous = selected?.history.present;
    const payload = {
      revision: FLOW_REVISION,
      prompt: requirement,
      ...(previous ? { previous: previous.document } : {}),
      ...(clarification
        ? { question: clarification.question, answer: clarification.answer }
        : {}),
    };
    lastClarifiedRequest.current = clarification;
    const sequence = ++generation.current;
    const aborter = new AbortController();
    controller.current = aborter;
    isBusy.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setPending(null);
    setAnswer("");
    setQuestionOpen(false);
    setProvisional(null);
    firstPaint.current = null;
    pendingPaint.current = null;
    setElapsed(0);
    started.current = performance.now();
    let accepted = false,
      layoutTotal = 0;
    async function receive(event: Record<string, unknown>) {
      if (aborter.signal.aborted || sequence !== generation.current)
        throw new Error("Generation stopped.");
      if (event.type === "error")
        throw new Error(
          String(event.error || "Could not generate the diagram."),
        );
      if (event.type === "status") {
        setNotice(String(event.message ?? "Checking diagram…"));
        return;
      }
      if (event.type === "clarification") {
        const question = String(event.question ?? "");
        if (!question) throw new Error("The clarification question was empty.");
        setPending({
          type: "clarification",
          question,
          options: Array.isArray(event.options)
            ? event.options.filter((s): s is string => typeof s === "string")
            : [],
          basePrompt: requirement,
        });
        setQuestionOpen(true);
        setCustomAnswer(false);
        accepted = true;
        return;
      }
      if (event.type !== "preview" && event.type !== "complete") return;
      const document = diagramSchema.parse(event.diagram);
      let positions = previous?.positions ?? {};
      let routes = previous?.routes,
        routeKey = previous?.routeKey;
      const unchanged =
        event.type === "complete" &&
        previous &&
        topology(previous.document) === topology(document);
      if (!unchanged) {
        const layout = await layoutDiagram(document);
        positions = layout.positions;
        routes = layout.routes;
        routeKey = layout.routeKey;
        layoutTotal += layout.elapsedMs;
      }
      if (aborter.signal.aborted || sequence !== generation.current)
        throw new Error("Generation stopped.");
      const next: FlowSnapshot = {
        document,
        positions,
        routes,
        routeKey,
        viewport: unchanged ? previous.viewport : { x: 0, y: 0, zoom: 1 },
      };
      if (event.type === "preview") {
        // One early connected layout stays stable while the rest is generated.
        setProvisional(next);
        return;
      }
      const metrics: Metrics = {
        firstUiMs: firstPaint.current,
        firstTextMs:
          typeof event.firstTextMs === "number" ? event.firstTextMs : null,
        firstGraphMs:
          typeof event.firstGraphMs === "number" ? event.firstGraphMs : null,
        elapsedMs: performance.now() - started.current,
        layoutMs: layoutTotal,
        corrections: Number(event.corrections ?? 0),
      };
      const version: Version = {
        id: ++counter.current,
        storageId: crypto.randomUUID(),
        clarification: clarification
          ? { question: clarification.question, answer: clarification.answer }
          : undefined,
        prompt: requirement,
        history: { past: [], present: next, future: [] },
        metrics,
      };
      pendingPaint.current = { id: version.id, start: started.current };
      setVersions((vs) => [version, ...vs]);
      workspace.complete({
        sessionKey: session.key,
        id: version.storageId,
        version: version.id,
        parentId: selected?.storageId ?? null,
        instruction: requirement,
        title: document.title,
        content: { type: "flowchart", snapshot: next },
        clarification: version.clarification,
      });
      setSelectedId(version.id);
      setNotice(
        previous && !unchanged
          ? "Layout updated to fit the revised steps."
          : "",
      );
      accepted = true;
    }
    try {
      const response = await generationFetch("/api/flowchart/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: aborter.signal,
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Could not generate.");
      }
      if (!response.body) throw new Error("The model stream was empty.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let split;
        while ((split = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          for (const line of block.split("\n"))
            if (line.startsWith("data: "))
              await receive(JSON.parse(line.slice(6)));
        }
        if (done) break;
      }
      if (!accepted)
        throw new Error("The stream ended before a complete diagram arrived.");
    } catch (e) {
      if (aborter.signal.aborted) {
        setNotice(
          "Generation stopped. Your completed versions are still available.",
        );
        // Stopping the CLI turn closes its process. Prepare a fresh worker now,
        // so the next click does not hide connection time inside generation.
        void connect();
      } else {
        setNotice("");
        setError(
          e instanceof Error
            ? e.message
            : "Could not finish. Retry or reconnect.",
        );
      }
    } finally {
      isBusy.current = false;
      setBusy(false);
      setProvisional(null);
      controller.current = null;
    }
  }
  function clear() {
    if (isBusy.current) return;
    workspace.clear("flowchart");
  }
  // The editor reports an actual paint, for the early path and final graph.
  function recordVisible() {
    if (isBusy.current && provisional) {
      if (firstPaint.current === null) {
        firstPaint.current = performance.now() - started.current;
      }
      return;
    }
    const pending = pendingPaint.current;
    if (!pending || pending.id !== selectedId || busy) return;
    pendingPaint.current = null;
    const ms = performance.now() - pending.start;
    setVersions((vs) =>
      vs.map((v) =>
        v.id === pending.id
          ? {
              ...v,
              metrics: {
                ...v.metrics,
                firstUiMs: firstPaint.current ?? ms,
                elapsedMs: ms,
              },
            }
          : v,
      ),
    );
  }
  return (
    <main className="studio flow-studio">
      <StudioHeader
        modeControls={modeControls}
        connection={connection}
        preparing="Preparing Flowchart…"
        reconnect={() => {
          setError("");
          void connect();
        }}
      />
      <div className="flow-workspace">
        <WorkspaceContextBar />
        <h1>Describe your process or user flow</h1>
        {selected && (
          <InstructionContext
            instruction={
              selected.clarification
                ? `${selected.prompt}\n\nClarification: ${selected.clarification.question}\nAnswer: ${selected.clarification.answer}`
                : selected.prompt
            }
            original={
              workspace.artifactFor(session.key)?.originalPrompt ??
              selected.prompt
            }
          />
        )}
        <form
          className="studio-composer flow-composer"
          onSubmit={(e) => {
            e.preventDefault();
            if (prompt.trim()) void generate();
          }}
        >
          <label htmlFor="flow-prompt" className="studio-sr-only">
            Describe your flowchart or refinement
          </label>
          <textarea
            id="flow-prompt"
            rows={2}
            maxLength={MAX_PROMPT_CHARACTERS}
            disabled={busy}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                if (prompt.trim()) void generate();
              }
            }}
            placeholder="Describe the steps, decisions, and outcomes…"
          />
          <div className="studio-composer-bottom">
            <span className="studio-composer-spacer" />
            <span className="studio-character-count" title="Characters, including spaces">
              {prompt.length.toLocaleString()} / {MAX_PROMPT_CHARACTERS.toLocaleString()}
            </span>
            {busy ? (
              <button
                key="stop"
                className="studio-generate studio-stop"
                type="button"
                onClick={() => controller.current?.abort()}
              >
                <Square size={11} fill="currentColor" /> Stop generation ·{" "}
                {seconds(elapsed)}
              </button>
            ) : (
              <button
                key="generate"
                className="studio-generate"
                disabled={
                  !prompt.trim() || connection !== "ready" || workspace.status === "error"
                }
                type="submit"
              >
                <WandSparkles size={13} />
                {selected ? "Refine flowchart" : "Generate flowchart"}
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </form>
        <div className="studio-starters" hidden={busy}>
          <span>Try these flows:</span>
          {flowStarters.map((s) => (
            <button
              key={s.label}
              disabled={busy}
              onClick={() => {
                setPrompt(s.prompt);
                if (selected)
                  setNotice(
                    "Use Clear to start a separate flowchart, or describe a change to refine this one.",
                  );
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        {pending && !questionOpen && (
          <div className="studio-notice">
            One question before we continue.
            <button
              className="studio-secondary"
              onClick={() => setQuestionOpen(true)}
            >
              Answer question
            </button>
          </div>
        )}
        {notice && !busy && (
          <div className="studio-notice" role="status">
            {notice}
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={13} />
            </button>
          </div>
        )}
        <section
          ref={previewRef}
          className={`flow-preview ${expanded ? "studio-preview-fullscreen" : ""}`}
          aria-label="Flowchart preview"
          data-first-ui-ms={selected?.metrics.firstUiMs ?? undefined}
          data-completion-ms={selected?.metrics.elapsedMs}
          aria-busy={busy}
        >
          {!snapshot ? (
            <div className="flow-preview-header">
              <span className="studio-preview-heading">
                <Workflow size={13} />
                Flowchart preview
              </span>
              <PreviewActions
                expanded={expanded}
                onFullscreen={() => void toggle()}
                onClear={clear}
                disabled={busy || workspace.status !== "saved"}
              />
            </div>
          ) : null}
          {!snapshot ? (
            <CanvasWaiting mode="flowchart" busy={busy} elapsed={elapsed} />
          ) : (
            <Editor
              key={busy ? "preview" : `version-${selectedId}`}
              snapshot={snapshot}
              disabled={busy}
              provisional={busy}
              onCommit={update}
              onTransient={transient}
              canUndo={!!selected?.history.past.length}
              canRedo={!!selected?.history.future.length}
              onUndo={() => travel(undo)}
              onRedo={() => travel(redo)}
              onError={setError}
              onClear={clear}
              clearDisabled={workspace.status !== "saved"}
              expanded={expanded}
              onFullscreen={() => void toggle()}
              onVisible={recordVisible}
              onLayout={(ms) => {
                if (selectedId !== null)
                  setVersions((vs) =>
                    vs.map((v) =>
                      v.id === selectedId
                        ? { ...v, metrics: { ...v.metrics, layoutMs: ms } }
                        : v,
                    ),
                  );
              }}
            />
          )}
          {error && (
            <div className="flow-failure-overlay">
              <div className="flow-failure" role="alert">
                <span className="flow-failure-mark">!</span>
                <h2>We couldn’t finish that.</h2>
                <p>{error}</p>
                <div>
                  <button
                    className="studio-primary"
                    disabled={busy || connection !== "ready"}
                    onClick={() => void generate(undefined, true)}
                  >
                    <RotateCcw size={12} /> Retry
                  </button>
                  {snapshot ? (
                    <button
                      className="studio-secondary"
                      onClick={() => setError("")}
                    >
                      Return to previous version
                    </button>
                  ) : (
                    <button
                      className="studio-secondary"
                      onClick={() => {
                        setError("");
                        void connect();
                      }}
                    >
                      Reconnect
                    </button>
                  )}
                </div>
                <button
                  className="studio-icon-button"
                  aria-label="Dismiss error"
                  onClick={() => setError("")}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      <footer className="studio-statusbar">
        <VersionMenu
          items={versions.map((v) => ({
            id: v.id,
            label: `v${v.id} · ${localTitle(workspace.artifactFor(session.key)?.title ?? v.history.present.document.title)}`,
            description: v.prompt,
          }))}
          selectedId={selectedId}
          disabled={busy}
          onSelect={(id) => {
            const v = versions.find((v) => v.id === id);
            if (!v) return;
            setSelectedId(id);
            setPrompt("");
            const artifact = workspace.artifactFor(session.key);
            if (artifact) workspace.selectVersion(artifact.id, v.storageId);
            setPending(null);
            setQuestionOpen(false);
            setError("");
            setNotice("");
          }}
        />
      </footer>
      <StudioDialog
        open={!!pending && questionOpen}
        onOpenChange={setQuestionOpen}
        title="One detail before we draw."
        description="This answer changes a decision or outcome in your flow."
        footer={
          <>
            {customAnswer && (
              <button
                className="studio-secondary"
                onClick={() => {
                  setCustomAnswer(false);
                  setAnswer("");
                }}
              >
                Back to options
              </button>
            )}
            <button
              className="studio-primary"
              disabled={!answer.trim() || busy}
              onClick={() => void generate(answer.trim())}
            >
              Continue <ArrowRight size={12} />
            </button>
          </>
        }
      >
        <h3 className="flow-question-title">{pending?.question}</h3>
        {!customAnswer ? (
          <div className="flow-question-options">
            <RadioGroup.Root
              className="flow-question-radios"
              value={answer}
              onValueChange={setAnswer}
              aria-label="Clarification choices"
            >
              {pending?.options?.map((option) => (
                <RadioGroup.Item key={option} value={option}>
                  <span />
                  {option}
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
            <button
              className="flow-custom-answer"
              onClick={() => {
                setCustomAnswer(true);
                setAnswer("");
              }}
            >
              I’ll describe it myself <ArrowRight size={12} />
            </button>
          </div>
        ) : (
          <label className="flow-custom-label">
            Your answer
            <textarea
              autoFocus
              aria-label="Clarification answer"
              maxLength={1000}
              rows={4}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <small>{answer.length} / 1,000</small>
          </label>
        )}
      </StudioDialog>
    </main>
  );
}

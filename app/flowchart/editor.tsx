"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BaseEdge,
  type EdgeProps,
  Handle,
  Position,
  MarkerType,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Tabs } from "radix-ui";
import {
  ArrowRight,
  ListTree,
  Maximize,
  Minus,
  Plus,
  Redo2,
  Undo2,
  Workflow,
  X,
} from "lucide-react";
import { localTitle } from "../lib/workspace/model";
import { useImageActions } from "../studio/use-image-actions";
import { ImageActions, ImageFeedback } from "../studio/image-actions";
import { StudioDialog, PreviewActions } from "../studio/components";
import {
  graphIssues,
  geometryKey,
  type EdgeRoute,
  dimensions,
  kinds,
  type FlowSnapshot,
  type FlowNode,
} from "../lib/flowchart/contract";
import { routeLabelBox } from "../lib/flowchart/route-label";
import { layoutDiagram, prepareLayout } from "../lib/flowchart/auto-layout";

type StepNode = Node<
  { label: string; kind: FlowNode["kind"]; direction: string },
  "step"
>;
function Step({ data }: NodeProps<StepNode>) {
  const sides = [Position.Top, Position.Right, Position.Bottom, Position.Left];
  return (
    <div className={`flow-node kind-${data.kind}`}>
      <div className="flow-node-surface" />
      <span>{data.label}</span>
      {sides.map((side) => (
        <span key={side}>
          {data.kind !== "start" && (
            <Handle
              title="Connect to this step (hollow point)"
              type="target"
              position={side}
              id={`in-${side}`}
              style={{
                [side === Position.Top || side === Position.Bottom
                  ? "left"
                  : "top"]: "calc(50% - 7px)",
              }}
            />
          )}
          {data.kind !== "end" && (
            <Handle
              title="Connect from this step (filled point)"
              type="source"
              position={side}
              id={`out-${side}`}
              style={{
                [side === Position.Top || side === Position.Bottom
                  ? "left"
                  : "top"]: "calc(50% + 7px)",
              }}
            />
          )}
        </span>
      ))}
    </div>
  );
}
function RoutedEdge(props: EdgeProps) {
  const route = props.data?.route as EdgeRoute;
  const path = route.points
    .map((p, i) => `${i ? "L" : "M"} ${p.x},${p.y}`)
    .join(" ");
  const label = routeLabelBox(route, String(props.label ?? ""));
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        style={props.style}
      />
      {props.label && label && (
        <g transform={`translate(${label.x},${label.y})`}>
          <rect width={label.width} height={label.height} rx={4} fill="white" />
          <text
            x={label.width / 2}
            y={16}
            textAnchor="middle"
            fill="#365f94"
            fontSize={12}
          >
            {props.label}
          </text>
        </g>
      )}
    </>
  );
}
const edgeTypes = { routed: RoutedEdge };
const nodeTypes = { step: Step };
export type EditorProps = {
  snapshot: FlowSnapshot;
  disabled: boolean;
  provisional?: boolean;
  onCommit: (s: FlowSnapshot, before?: FlowSnapshot) => void;
  onTransient: (
    s: Partial<Pick<FlowSnapshot, "positions" | "viewport">>,
  ) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onError: (s: string) => void;
  onLayout: (ms: number) => void;
  onClear: () => void;
  clearDisabled?: boolean;
  expanded: boolean;
  onFullscreen: () => void;
  onVisible: () => void;
};
export default function FlowEditor({
  snapshot,
  disabled,
  provisional = false,
  onCommit,
  onTransient,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onError,
  onLayout,
  onClear,
  clearDisabled = false,
  expanded,
  onFullscreen,
  onVisible,
}: EditorProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"outline" | "assumptions">(
    "outline",
  );
  const [zoom, setZoom] = useState(snapshot.viewport.zoom);
  const visibleCallback = useRef(onVisible);
  useEffect(() => {
    visibleCallback.current = onVisible;
  }, [onVisible]);
  const [selection, setSelection] = useState<{
    kind: "node" | "edge";
    id: string;
  } | null>(null);
  const [instance, setInstance] = useState<ReactFlowInstance<
    StepNode,
    Edge
  > | null>(null);
  const [layingOut, setLayingOut] = useState(false);
  const images = useImageActions(
    captureDiagramPng,
    snapshot.document.title,
    `${snapshot.document.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 70) || "flowchart"}.png`,
  );
  const exporting = !!images.job;
  const canvas = useRef<HTMLDivElement>(null),
    dragBefore = useRef<FlowSnapshot | null>(null);
  const labelInput = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(snapshot);
  useEffect(() => {
    latest.current = snapshot;
  }, [snapshot]);
  useEffect(() => {
    if (!instance) return;
    let first = 0,
      second = 0;
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => visibleCallback.current());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [instance]);
  const blocked = disabled || exporting || layingOut;
  useEffect(() => {
    prepareLayout();
  }, []);
  const nodes: StepNode[] = useMemo(
    () =>
      snapshot.document.nodes.map((n) => ({
        id: n.id,
        type: "step",
        position: snapshot.positions[n.id] ?? { x: 0, y: 0 },
        data: {
          label: n.label,
          kind: n.kind,
          direction: snapshot.document.direction,
        },
        ...dimensions(n),
        selected: selection?.kind === "node" && selection.id === n.id,
      })),
    [snapshot, selection],
  );
  const edges: Edge[] = useMemo(
    () =>
      snapshot.document.edges.map((e) => {
        const s = snapshot.positions[e.source],
          t = snapshot.positions[e.target],
          horizontal = snapshot.document.direction === "RIGHT";
        const back = s && t && (horizontal ? t.x <= s.x : t.y <= s.y);
        const route =
          snapshot.routeKey ===
          geometryKey(snapshot.document, snapshot.positions)
            ? snapshot.routes?.[e.id]
            : undefined;
        return {
          ...e,
          ...(route ? { data: { route } } : {}),
          type: route ? "routed" : "smoothstep",
          sourceHandle:
            !route && back
              ? "out-left"
              : horizontal
                ? "out-right"
                : "out-bottom",
          targetHandle:
            !route && back ? "in-left" : horizontal ? "in-left" : "in-top",
          label: e.label,
          selected: selection?.kind === "edge" && selection.id === e.id,
          ariaLabel: `${snapshot.document.nodes.find((n) => n.id === e.source)?.label} → ${snapshot.document.nodes.find((n) => n.id === e.target)?.label}${e.label ? `: ${e.label}` : ""}`,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#4086ee" },
          style: { stroke: "#4086ee", strokeWidth: 1.7 },
          labelStyle: { fill: "#365f94", fontSize: 12 },
          labelBgStyle: { fill: "#fff" },
          labelBgPadding: [6, 4],
          pathOptions: { offset: 40, borderRadius: 12 },
        };
      }),
    [snapshot, selection],
  );
  const issues = useMemo(
    () => graphIssues(snapshot.document),
    [snapshot.document],
  );
  const selectedNode =
    selection?.kind === "node"
      ? snapshot.document.nodes.find((n) => n.id === selection.id)
      : undefined;
  const selectedEdge =
    selection?.kind === "edge"
      ? snapshot.document.edges.find((e) => e.id === selection.id)
      : undefined;
  function connect(c: Connection, id?: string) {
    if (blocked || !c.source || !c.target) return;
    const old = id
      ? snapshot.document.edges.find((e) => e.id === id)
      : undefined;
    const e = {
      id: id ?? `e-${crypto.randomUUID()}`,
      source: c.source,
      target: c.target,
      ...(old?.label ? { label: old.label } : {}),
    };
    if (snapshot.document.edges.length >= 60 && !id) {
      onError("This MVP supports up to 60 arrows.");
      return;
    }
    onCommit({
      ...snapshot,
      document: {
        ...snapshot.document,
        edges: [...snapshot.document.edges.filter((e) => e.id !== id), e],
      },
    });
  }
  async function arrange(direction = snapshot.document.direction) {
    setLayingOut(true);
    try {
      const document = { ...snapshot.document, direction };
      const result = await layoutDiagram(document);
      onLayout(result.elapsedMs);
      onCommit({
        ...snapshot,
        document,
        positions: result.positions,
        routes: result.routes,
        routeKey: result.routeKey,
      });
      requestAnimationFrame(() => void instance?.fitView({ padding: 0.18 }));
    } catch {
      onError("Could not arrange this diagram. Your edits are preserved.");
    } finally {
      setLayingOut(false);
    }
  }
  function remove() {
    if (!selection || blocked) return;
    onCommit({
      ...snapshot,
      document: {
        ...snapshot.document,
        nodes: snapshot.document.nodes.filter(
          (n) => selection.kind !== "node" || n.id !== selection.id,
        ),
        edges: snapshot.document.edges.filter((e) =>
          selection.kind === "edge"
            ? e.id !== selection.id
            : e.source !== selection.id && e.target !== selection.id,
        ),
      },
    });
    setSelection(null);
  }
  async function captureDiagramPng(): Promise<Blob> {
    if (!instance || !canvas.current)
      throw new Error("Wait for the diagram to finish loading.");
    await document.fonts.ready;
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    const { toBlob } = await import("html-to-image");
    const bounds = getNodesBounds(instance.getNodes());
    if (
      snapshot.routeKey === geometryKey(snapshot.document, snapshot.positions)
    ) {
      let minX = bounds.x,
        minY = bounds.y,
        maxX = bounds.x + bounds.width,
        maxY = bounds.y + bounds.height;
      for (const [id, route] of Object.entries(snapshot.routes ?? {})) {
        for (const p of route.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
        const l = routeLabelBox(
          route,
          snapshot.document.edges.find((e) => e.id === id)?.label ?? "",
        );
        if (l) {
          minX = Math.min(minX, l.x);
          minY = Math.min(minY, l.y);
          maxX = Math.max(maxX, l.x + l.width);
          maxY = Math.max(maxY, l.y + l.height);
        }
      }
      Object.assign(bounds, {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      });
    }
    const scale = Math.min(
      1,
      4096 / Math.max(bounds.width + 180, bounds.height + 180),
    );
    const width = Math.ceil((bounds.width + 180) * scale),
      height = Math.ceil((bounds.height + 180) * scale);
    const view = getViewportForBounds(bounds, width, height, 0.01, 1, 0.12);
    const viewport = canvas.current.querySelector<HTMLElement>(
      ".react-flow__viewport",
    );
    if (!viewport) throw new Error();
    const blob = await toBlob(viewport, {
      backgroundColor: "#ffffff",
      width,
      height,
      pixelRatio: 2,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
      },
      filter: (n) =>
        !(n instanceof Element) ||
        (!n.classList.contains("react-flow__handle") &&
          !n.classList.contains("react-flow__edgeupdater")),
    });
    if (!blob)
      throw new Error(
        "PNG preparation could not finish. Try again after the diagram settles.",
      );
    return blob;
  }

  return (
    <div className={`flow-editor ${exporting ? "flow-exporting" : ""}`}>
      <div className="flow-preview-header">
        <span className="flow-title">
          <Workflow size={13} />
          <strong>{localTitle(snapshot.document.title || "Flowchart")}</strong>
          {provisional && (
            <span className="studio-preview-label">Generating…</span>
          )}
        </span>
        <div className="studio-canvas-tools">
          <button
            className="flow-details-trigger"
            disabled={blocked}
            onClick={() => setDetailsOpen(true)}
          >
            <ListTree size={12} /> Flow details
          </button>
          <PreviewActions
            expanded={expanded}
            onFullscreen={onFullscreen}
            onClear={onClear}
            disabled={blocked || clearDisabled}
          />
        </div>
      </div>
      <ImageFeedback actions={images} />
      <div className="flow-canvas-row">
        <div ref={canvas} className="flow-canvas" aria-label="Flowchart canvas">
          <ReactFlow<StepNode>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            panOnScroll
            zoomOnScroll={false}
            minZoom={0.08}
            maxZoom={2}
            fitViewOptions={{ padding: 0.18 }}
            onInit={(i) => {
              setInstance(i);
              if (snapshot.viewport.initialized)
                void i.setViewport(snapshot.viewport);
              else
                requestAnimationFrame(() => {
                  const bounds = getNodesBounds(i.getNodes());
                  const width = canvas.current?.clientWidth ?? 900;
                  const height = canvas.current?.clientHeight ?? 600;
                  const horizontal = snapshot.document.direction === "RIGHT";
                  const zoom = horizontal
                    ? 0.85
                    : Math.min(
                        0.85,
                        Math.max(0.45, width / (bounds.width + 140)),
                      );
                  void i.setViewport({
                    // At readable zoom a wide graph can exceed the canvas.
                    // Keep Start visible instead of centering it off-screen.
                    x:
                      (horizontal ? 36 : (width - bounds.width * zoom) / 2) -
                      bounds.x * zoom,
                    y:
                      (horizontal
                        ? Math.max(40, (height - bounds.height * zoom) / 2)
                        : 45) -
                      bounds.y * zoom,
                    zoom,
                  });
                });
            }}
            nodesDraggable={!blocked}
            nodesConnectable={!blocked}
            edgesReconnectable={!blocked}
            elementsSelectable={!blocked}
            deleteKeyCode={null}
            onConnect={(c) => connect(c)}
            onReconnect={(e, c) => connect(c, e.id)}
            onNodeClick={(_, n) => {
              if (!blocked) setSelection({ kind: "node", id: n.id });
            }}
            onNodeDoubleClick={(_, n) => {
              if (!blocked) setSelection({ kind: "node", id: n.id });
            }}
            onEdgeClick={(_, e) => {
              if (!blocked) setSelection({ kind: "edge", id: e.id });
            }}
            onPaneClick={() => setSelection(null)}
            onNodeDragStart={() => {
              dragBefore.current = structuredClone(snapshot);
            }}
            onNodesChange={(changes) => {
              if (blocked) return;
              const positions = { ...snapshot.positions };
              let changed = false;
              for (const c of changes)
                if (c.type === "position" && c.position) {
                  positions[c.id] = c.position;
                  changed = true;
                }
              if (changed) onTransient({ positions });
            }}
            onNodeDragStop={(_, node) => {
              const now = {
                ...latest.current,
                positions: {
                  ...latest.current.positions,
                  [node.id]: node.position,
                },
              };
              onCommit(now, dragBefore.current ?? undefined);
              dragBefore.current = null;
            }}
            onMoveEnd={(_, viewport) => {
              setZoom(viewport.zoom);
              if (!disabled)
                onTransient({
                  viewport: { ...viewport, initialized: true },
                });
            }}
          >
            <Background color="#c7d3e4" gap={24} size={1} />
          </ReactFlow>
          <div
            className="flow-floating-toolbar"
            role="toolbar"
            aria-label="Diagram tools"
          >
            <button
              title="Zoom out"
              aria-label="Zoom out"
              disabled={blocked}
              onClick={() => void instance?.zoomOut()}
            >
              <Minus size={13} />
            </button>
            <span className="flow-zoom">{Math.round(zoom * 100)}%</span>
            <button
              title="Zoom in"
              aria-label="Zoom in"
              disabled={blocked}
              onClick={() => void instance?.zoomIn()}
            >
              <Plus size={13} />
            </button>
            <span className="flow-tool-divider" />
            <button
              title="Undo"
              aria-label="Undo"
              disabled={blocked || !canUndo}
              onClick={onUndo}
            >
              <Undo2 size={13} />
            </button>
            <button
              title="Redo"
              aria-label="Redo"
              disabled={blocked || !canRedo}
              onClick={onRedo}
            >
              <Redo2 size={13} />
            </button>
            <select
              aria-label="Flow direction"
              disabled={blocked}
              value={snapshot.document.direction}
              onChange={(e) => void arrange(e.target.value as "DOWN" | "RIGHT")}
            >
              <option value="DOWN">Top to bottom</option>
              <option value="RIGHT">Left to right</option>
            </select>
            <button disabled={blocked} onClick={() => void arrange()}>
              Re-layout
            </button>
            <button
              disabled={blocked}
              onClick={() => void instance?.fitView({ padding: 0.18 })}
            >
              <Maximize size={12} /> Fit view
            </button>
            <button
              disabled={blocked || snapshot.document.nodes.length >= 30}
              onClick={() => {
                const id = `n-${crypto.randomUUID()}`;
                const p = instance?.screenToFlowPosition({
                  x: (canvas.current?.getBoundingClientRect().left ?? 0) + 320,
                  y: (canvas.current?.getBoundingClientRect().top ?? 0) + 200,
                }) ?? { x: 100, y: 100 };
                onCommit({
                  ...snapshot,
                  document: {
                    ...snapshot.document,
                    nodes: [
                      ...snapshot.document.nodes,
                      { id, kind: "process", label: "New step" },
                    ],
                  },
                  positions: { ...snapshot.positions, [id]: p },
                });
                setSelection({ kind: "node", id });
              }}
            >
              <Plus size={12} /> Add step
            </button>
            <ImageActions
              actions={images}
              disabled={disabled || layingOut || !instance}
            />
          </div>
        </div>
        {(selectedNode || selectedEdge) && (
          <aside className="flow-inspector" aria-label="Selection inspector">
            <div className="flow-inspector-header">
              <strong>
                {selectedNode ? "Step inspector" : "Arrow inspector"}
              </strong>
              <button
                className="studio-icon-button"
                aria-label="Close inspector"
                onClick={() => setSelection(null)}
              >
                <X size={15} />
              </button>
            </div>
            <span className="flow-inspector-caption">
              {selectedNode ? "STEP LABEL" : "BRANCH LABEL"}
            </span>
            <label>
              <span className="studio-sr-only">Label</span>
              <textarea
                key={`${selection?.id}:${selectedNode?.label ?? selectedEdge?.label ?? ""}`}
                ref={labelInput}
                aria-label="Selected label"
                rows={4}
                disabled={blocked}
                defaultValue={selectedNode?.label ?? selectedEdge?.label ?? ""}
                maxLength={selectedNode ? 180 : 100}
                onBlur={(e) => {
                  const label = e.target.value.trim();
                  if (selectedNode && label)
                    onCommit({
                      ...snapshot,
                      document: {
                        ...snapshot.document,
                        nodes: snapshot.document.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, label } : n,
                        ),
                      },
                    });
                  if (selectedEdge)
                    onCommit({
                      ...snapshot,
                      document: {
                        ...snapshot.document,
                        edges: snapshot.document.edges.map((edge) =>
                          edge.id === selectedEdge.id
                            ? { ...edge, label }
                            : edge,
                        ),
                      },
                    });
                }}
              />
            </label>
            {selectedNode && (
              <label>
                Step type
                <select
                  aria-label="Step type"
                  disabled={blocked}
                  value={selectedNode.kind}
                  onChange={(e) =>
                    onCommit({
                      ...snapshot,
                      document: {
                        ...snapshot.document,
                        nodes: snapshot.document.nodes.map((n) =>
                          n.id === selectedNode.id
                            ? {
                                ...n,
                                kind: e.target.value as FlowNode["kind"],
                                label:
                                  labelInput.current?.value.trim() || n.label,
                              }
                            : n,
                        ),
                      },
                    })
                  }
                >
                  {kinds.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selectedNode &&
              snapshot.document.edges.some(
                (e) => e.source === selectedNode.id,
              ) && (
                <div className="flow-outgoing">
                  <span>OUTGOING CONNECTIONS</span>
                  {snapshot.document.edges
                    .filter((e) => e.source === selectedNode.id)
                    .map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setSelection({ kind: "edge", id: e.id })}
                      >
                        <strong>{e.label || "Next"}</strong>
                        <ArrowRight size={11} />
                        <span>
                          {
                            snapshot.document.nodes.find(
                              (n) => n.id === e.target,
                            )?.label
                          }
                        </span>
                      </button>
                    ))}
                </div>
              )}
            <span className="flow-inspector-spacer" />
            <button className="flow-delete" disabled={blocked} onClick={remove}>
              Delete {selectedNode ? "step" : "arrow"}
            </button>
          </aside>
        )}
      </div>
      <StudioDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        title="Flow details"
        description={localTitle(snapshot.document.title)}
      >
        <Tabs.Root
          value={detailTab}
          onValueChange={(value) =>
            setDetailTab(value as "outline" | "assumptions")
          }
        >
          <Tabs.List className="flow-detail-tabs" aria-label="Flow details">
            <Tabs.Trigger value="outline">
              Flow outline <span>{snapshot.document.nodes.length}</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="assumptions">
              Assumptions <span>{snapshot.document.assumptions.length}</span>
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value={detailTab}>
            {detailTab === "outline" ? (
              <>
                {!!issues.length && (
                  <div className="flow-detail-warnings">
                    <strong>Connections to review</strong>
                    <ul>
                      {issues.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <ol className="flow-outline-list">
                  {snapshot.document.nodes.map((n, i) => (
                    <li key={n.id}>
                      <span className="flow-outline-number">{i + 1}</span>
                      <div>
                        <span className={`flow-kind-badge kind-${n.kind}`}>
                          {n.kind.replace("-", " / ")}
                        </span>
                        <strong>{n.label}</strong>
                        {snapshot.document.edges
                          .filter((e) => e.source === n.id)
                          .map((e) => (
                            <p key={e.id}>
                              {e.label && <b>{e.label} · </b>}→{" "}
                              {
                                snapshot.document.nodes.find(
                                  (n) => n.id === e.target,
                                )?.label
                              }
                            </p>
                          ))}
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            ) : snapshot.document.assumptions.length ? (
              <ol className="flow-assumption-list">
                {snapshot.document.assumptions.map((s, i) => (
                  <li key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <p>{s}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flow-no-assumptions">
                No assumptions were added to this flow.
              </div>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </StudioDialog>
    </div>
  );
}

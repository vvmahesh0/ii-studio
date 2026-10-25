"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  WorkspaceStorage,
  removeArtifacts,
  persistGeneration,
  type Write,
} from "../lib/workspace/storage";
import {
  emptyIndex,
  localTitle,
  shortTitle,
  type Artifact,
  type Content,
  type Conversation,
  type Generation,
  type Index,
  type Mode,
  type Session,
  type Project,
} from "../lib/workspace/model";
import type { FlowSnapshot } from "../lib/flowchart/contract";
import { validateLoadedArtifact } from "../lib/workspace/validation";

type Status = "loading" | "saved" | "saving" | "error";
type Complete = {
  sessionKey: string;
  id: string;
  version: number;
  parentId: string | null;
  instruction: string;
  title: string;
  content: Content;
  clarification?: { question: string; answer: string };
};
type Binding = { artifact: Artifact | null; conversationId: string | null };
type Workspace = {
  artifactFor: (key: string) => Artifact | null;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  index: Index;
  status: Status;
  error: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  sessions: Record<Mode, Session>;
  conversationId: string | null;
  projectId: string | null;
  newConversation: (projectId?: string | null) => void;
  clear: (mode: Mode, theme?: "default" | "modern", draft?: string) => void;
  complete: (v: Complete) => void;
  selectVersion: (artifactId: string, generationId: string) => void;
  saveWorking: (generationId: string, snapshot: FlowSnapshot) => void;
  openArtifact: (id: string) => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  createProject: (name: string) => void;
  rename: (
    type: "projects" | "conversations" | "artifacts",
    id: string,
    title: string,
  ) => void;
  remove: (
    type: "projects" | "conversations" | "artifacts",
    id: string,
  ) => void;
  move: (conversationId: string, projectId: string | null) => void;
  retry: () => void;
  dismissError: () => void;
  storage: React.MutableRefObject<WorkspaceStorage | null>;
  transact: (fn: (tx: Write) => Promise<void>) => void;
};
const Context = createContext<Workspace | null>(null);
const fresh = (theme?: "default" | "modern"): Session => ({
  key: crypto.randomUUID(),
  loaded: null,
  theme,
});
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const storage = useRef<WorkspaceStorage | null>(null);
  const initialize = useRef<(() => Promise<void>) | null>(null);
  const initialized = useRef(false);
  const navigationSequence = useRef(0);
  const externalChange = useRef(false);
  const revision = useRef(0),
    tasks = useRef<(() => Promise<void>)[]>([]),
    running = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [index, setIndex] = useState<Index>(emptyIndex);
  const indexRef = useRef(index);
  const [status, setStatus] = useState<Status>("loading"),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [mode, setModeState] = useState<Mode>("interface");
  const [sessions, setSessions] = useState<Record<Mode, Session>>({
    interface: { key: "initial-ui", loaded: null },
    flowchart: { key: "initial-flow", loaded: null },
  });
  const [conversationId, setConversationId] = useState<string | null>(null),
    [projectId, setProjectId] = useState<string | null>(null);
  const conversationRef = useRef<string | null>(null),
    projectRef = useRef<string | null>(null);
  const bindings = useRef(new Map<string, Binding>());
  const working = useRef(new Map<string, FlowSnapshot>()),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function fail(e: unknown) {
    setStatus("error");
    setError(
      e instanceof Error && e.name === "QuotaExceededError"
        ? "Browser storage is full. Keep this tab open, free some space, then retry saving."
        : e instanceof Error && e.name === "ZodError"
          ? "Some saved data could not be read. It has been kept unchanged."
          : e instanceof Error
            ? e.message
            : "Couldn't save this work locally.",
    );
  }
  async function drain() {
    if (running.current) return;
    running.current = true;
    setStatus("saving");
    try {
      while (tasks.current.length) {
        await tasks.current[0]();
        tasks.current.shift();
      }
      setStatus(working.current.size ? "saving" : "saved");
      setError("");
    } catch (e) {
      fail(e);
    } finally {
      running.current = false;
    }
  }
  function transact(fn: (tx: Write) => Promise<void>) {
    let committed = false;
    tasks.current.push(async () => {
      if (!storage.current)
        throw new Error(
          "Local storage is unavailable. Keep this tab open and retry.",
        );
      if (!committed) {
        revision.current = await storage.current.write(revision.current, fn);
        committed = true;
        channel.current?.postMessage({ revision: revision.current });
      }
      const next = await storage.current.index();
      indexRef.current = next;
      setIndex(next);
    });
    if (status !== "error") void drain();
  }
  function flushWorking() {
    if (timer.current) clearTimeout(timer.current);
    if (!working.current.size) return;
    const pending = [...working.current];
    working.current.clear();
    transact(async (tx) => {
      for (const [generationId, snapshot] of pending) {
        const g = await tx.objectStore("generations").get(generationId);
        if (!g || g.type !== "flowchart")
          throw new Error("This flowchart version is no longer available.");
        await tx
          .objectStore("working")
          .put({ generationId, snapshot, updatedAt: new Date().toISOString() });
        const a = await tx.objectStore("artifacts").get(g.artifactId);
        if (a)
          await tx
            .objectStore("artifacts")
            .put({ ...a, updatedAt: new Date().toISOString() });
      }
    });
  }
  function saveWorking(generationId: string, snapshot: FlowSnapshot) {
    working.current.set(generationId, structuredClone(snapshot));
    setStatus((s) => (s === "error" ? s : "saving"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flushWorking, 400);
  }
  async function loadArtifact(
    id: string,
    boot = false,
    request = ++navigationSequence.current,
  ) {
    if (!storage.current) return;
    const loaded = await storage.current.load(id);
    await validateLoadedArtifact(loaded);
    if (request !== navigationSequence.current) return;
    const c = indexRef.current.conversations.find(
      (c) => c.id === loaded.artifact.conversationId,
    );
    if (!c) throw new Error("This creation's conversation is missing.");
    if (
      c.projectId &&
      !indexRef.current.projects.some((p) => p.id === c.projectId)
    )
      throw new Error("This conversation's project is missing.");
    const key = crypto.randomUUID();
    bindings.current.set(key, {
      artifact: loaded.artifact,
      conversationId: c.id,
    });
    const changed = conversationRef.current !== c.id;
    conversationRef.current = c.id;
    projectRef.current = c.projectId;
    setConversationId(c.id);
    setProjectId(c.projectId);
    setModeState(loaded.artifact.type);
    setSessions((prev) => ({
      ...(changed ? { interface: fresh(), flowchart: fresh() } : prev),
      [loaded.artifact.type]: { key, loaded },
    }));
    if (!boot)
      transact(async (tx) => {
        const meta = await tx.objectStore("meta").get("workspace");
        await tx.objectStore("meta").put({
          key: "workspace",
          revision: meta?.revision ?? revision.current,
          activeArtifactId: id,
        });
      });
  }
  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const db = new WorkspaceStorage();
        storage.current = db;
        const next = await db.index();
        if (!active) return;
        revision.current = next.revision;
        indexRef.current = next;
        setIndex(next);
        initialized.current = true;
        if (
          next.activeArtifactId &&
          next.artifacts.some((a) => a.id === next.activeArtifactId)
        )
          try {
            await loadArtifact(next.activeArtifactId, true);
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Couldn't open the last creation. Choose another from navigation.",
            );
          }
        if (active) setStatus("saved");
      } catch (e) {
        if (active) fail(e);
      }
    }
    initialize.current = boot;
    void boot();
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("ii-studio-workspace");
      channel.current.onmessage = (e) => {
        if (e.data?.revision > revision.current) {
          externalChange.current = true;
          fail(
            new Error(
              "Another tab changed saved work. Reload this tab before making more changes.",
            ),
          );
        }
      };
    }
    const leave = (e: BeforeUnloadEvent) => {
      if (working.current.size || tasks.current.length) {
        flushWorking();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const hide = () => {
      if (document.visibilityState === "hidden") flushWorking();
    };
    window.addEventListener("beforeunload", leave);
    document.addEventListener("visibilitychange", hide);
    return () => {
      active = false;
      channel.current?.close();
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("visibilitychange", hide);
    };
    // Initialize once. All asynchronous writes use refs for the current revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function reset(project: string | null, conversation: string | null) {
    ++navigationSequence.current;
    flushWorking();
    conversationRef.current = conversation;
    projectRef.current = project;
    setConversationId(conversation);
    setProjectId(project);
    setSessions((prev) => {
      const active = prev.interface.loaded?.generations.find(
        (g) => g.id === prev.interface.loaded?.artifact.activeGenerationId,
      );
      return {
        interface: fresh(
          active?.type === "interface" ? active.theme : prev.interface.theme,
        ),
        flowchart: fresh(),
      };
    });
  }
  function newConversation(project = projectRef.current) {
    reset(project, null);
    transact(async (tx) => {
      const m = await tx.objectStore("meta").get("workspace");
      await tx.objectStore("meta").put({
        key: "workspace",
        revision: m?.revision ?? revision.current,
        activeArtifactId: null,
      });
    });
  }
  function clear(type: Mode, theme?: "default" | "modern", draft?: string) {
    flushWorking();
    setSessions((prev) => ({
      ...prev,
      [type]: { ...fresh(theme ?? prev[type].theme), draft },
    }));
    transact(async (tx) => {
      const m = await tx.objectStore("meta").get("workspace");
      await tx.objectStore("meta").put({
        key: "workspace",
        revision: m?.revision ?? revision.current,
        activeArtifactId: null,
      });
    });
  }
  function complete(v: Complete) {
    const now = new Date().toISOString();
    let binding = bindings.current.get(v.sessionKey);
    const cId =
      binding?.conversationId ?? conversationRef.current ?? crypto.randomUUID();
    const aId = binding?.artifact?.id ?? crypto.randomUUID();
    const title = localTitle(v.instruction);
    const artifact: Artifact = binding?.artifact
      ? {
          ...binding.artifact,
          updatedAt: now,
          activeGenerationId: v.id,
          latestGenerationId: v.id,
        }
      : {
          id: aId,
          conversationId: cId,
          type: v.content.type,
          title,
          originalPrompt: v.instruction,
          createdAt: now,
          updatedAt: now,
          activeGenerationId: v.id,
          latestGenerationId: v.id,
        };
    binding = { artifact, conversationId: cId };
    bindings.current.set(v.sessionKey, binding);
    conversationRef.current = cId;
    setConversationId(cId);
    const conversation: Conversation = {
      id: cId,
      projectId: projectRef.current,
      title,
      createdAt: now,
      updatedAt: now,
    };
    const generation: Generation = {
      id: v.id,
      artifactId: aId,
      version: v.version,
      parentGenerationId: v.parentId,
      instruction: v.instruction,
      createdAt: now,
      completedAt: now,
      schemaVersion: 1,
      ...(v.clarification ? { clarification: v.clarification } : {}),
      ...v.content,
    };
    transact((tx) => persistGeneration(tx, conversation, artifact, generation));
  }
  function selectVersion(artifactId: string, generationId: string) {
    for (const [key, b] of bindings.current)
      if (b.artifact?.id === artifactId)
        bindings.current.set(key, {
          ...b,
          artifact: { ...b.artifact, activeGenerationId: generationId },
        });
    transact(async (tx) => {
      const a = await tx.objectStore("artifacts").get(artifactId);
      if (a)
        await tx
          .objectStore("artifacts")
          .put({ ...a, activeGenerationId: generationId });
    });
  }
  async function openArtifact(id: string) {
    const request = ++navigationSequence.current;
    if (busy || status === "loading" || status === "error") return;
    flushWorking();
    await drain();
    if (tasks.current.length) return;
    try {
      await loadArtifact(id, false, request);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't open this saved creation.",
      );
    }
  }
  async function openConversation(id: string) {
    const c = indexRef.current.conversations.find((c) => c.id === id);
    if (!c) return;
    const artifacts = indexRef.current.artifacts
      .filter((a) => a.conversationId === id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (artifacts[0]) await openArtifact(artifacts[0].id);
    else reset(c.projectId, c.id);
  }
  function createProject(name: string) {
    if (!name.trim()) return;
    name = shortTitle(name);
    if (!name) return;
    const now = new Date().toISOString();
    const p: Project = {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
    };
    transact(async (tx) => {
      await tx.objectStore("projects").add(p);
    });
    reset(p.id, null);
  }
  function rename(
    type: "projects" | "conversations" | "artifacts",
    id: string,
    title: string,
  ) {
    title = shortTitle(title);
    if (!title) return;
    transact(async (tx) => {
      const record = await tx.objectStore(type).get(id);
      if (!record) throw new Error("This item no longer exists.");
      if (type === "projects")
        await tx.objectStore("projects").put({
          ...(record as Project),
          name: title,
          updatedAt: new Date().toISOString(),
        });
      else if (type === "conversations")
        await tx.objectStore("conversations").put({
          ...(record as Conversation),
          title,
          updatedAt: new Date().toISOString(),
        });
      else
        await tx.objectStore("artifacts").put({
          ...(record as Artifact),
          title,
          updatedAt: new Date().toISOString(),
        });
    });
  }
  function remove(
    type: "projects" | "conversations" | "artifacts",
    id: string,
  ) {
    const idx = indexRef.current;
    const cs =
      type === "projects"
        ? idx.conversations.filter((c) => c.projectId === id).map((c) => c.id)
        : type === "conversations"
          ? [id]
          : [];
    const as =
      type === "artifacts"
        ? [id]
        : idx.artifacts
            .filter((a) => cs.includes(a.conversationId))
            .map((a) => a.id);
    transact(async (tx) => {
      await removeArtifacts(tx, as);
      if (type === "artifacts") {
        const a = idx.artifacts.find((a) => a.id === id);
        if (
          a &&
          !idx.artifacts.some(
            (other) =>
              other.id !== id && other.conversationId === a.conversationId,
          )
        )
          await tx.objectStore("conversations").delete(a.conversationId);
      }
      for (const c of cs) await tx.objectStore("conversations").delete(c);
      if (type === "projects") await tx.objectStore("projects").delete(id);
    });
    const activeArtifact = bindings.current.get(sessions[mode].key)?.artifact;
    const lastArtifact =
      type === "artifacts" ? idx.artifacts.find((a) => a.id === id) : null;
    const removedCurrentConversation =
      cs.includes(conversationRef.current ?? "") ||
      (lastArtifact?.conversationId === conversationRef.current &&
        !idx.artifacts.some(
          (a) =>
            a.id !== id && a.conversationId === lastArtifact.conversationId,
        ));
    if (
      removedCurrentConversation ||
      (activeArtifact && as.includes(activeArtifact.id))
    ) {
      reset(
        type === "projects" && projectRef.current === id
          ? null
          : projectRef.current,
        null,
      );
    } else {
      setSessions(
        (prev) =>
          Object.fromEntries(
            Object.entries(prev).map(([type, session]) => {
              const a = bindings.current.get(session.key)?.artifact;
              return [
                type,
                a && as.includes(a.id) ? fresh(session.theme) : session,
              ];
            }),
          ) as Record<Mode, Session>,
      );
    }
  }
  function move(id: string, projectId: string | null) {
    transact(async (tx) => {
      const c = await tx.objectStore("conversations").get(id);
      if (c)
        await tx
          .objectStore("conversations")
          .put({ ...c, projectId, updatedAt: new Date().toISOString() });
    });
    if (conversationRef.current === id) {
      projectRef.current = projectId;
      setProjectId(projectId);
    }
  }
  const value: Workspace = {
    artifactFor: (key) => {
      const a = bindings.current.get(key)?.artifact;
      return a ? (index.artifacts.find((v) => v.id === a.id) ?? a) : null;
    },
    drawerOpen,
    setDrawerOpen,
    index,
    status,
    error,
    busy,
    setBusy,
    mode,
    setMode: (nextMode) => {
      flushWorking();
      setModeState(nextMode);
      const a = bindings.current.get(sessions[nextMode].key)?.artifact;
      transact(async (tx) => {
        const m = await tx.objectStore("meta").get("workspace");
        await tx.objectStore("meta").put({
          key: "workspace",
          revision: m?.revision ?? revision.current,
          activeArtifactId: a?.id ?? null,
        });
      });
    },
    sessions,
    conversationId,
    projectId,
    newConversation,
    clear,
    complete,
    selectVersion,
    saveWorking,
    openArtifact,
    openConversation,
    createProject,
    rename,
    remove,
    move,
    retry: () => {
      if (externalChange.current) {
        setError(
          "Another tab changed saved work. Reload this tab; unsaved work in this tab will not overwrite the other tab.",
        );
        return;
      }
      if (!initialized.current) {
        setStatus("loading");
        void initialize.current?.();
        return;
      }
      setError("");
      void drain();
    },
    dismissError: () => setError(""),
    storage,
    transact,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing workspace provider.");
  return value;
}

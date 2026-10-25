import {
  openDB,
  type IDBPDatabase,
  type IDBPTransaction,
  type DBSchema,
} from "idb";
import {
  artifactSchema,
  conversationSchema,
  projectSchema,
  generationSchema,
  workingSchema,
  type Index,
  type Project,
  type Conversation,
  type Artifact,
  type Generation,
  type WorkingDocument,
  type LoadedArtifact,
} from "./model.ts";

interface WorkspaceDB extends DBSchema {
  projects: { key: string; value: Project };
  conversations: {
    key: string;
    value: Conversation;
    indexes: { projectId: string };
  };
  artifacts: {
    key: string;
    value: Artifact;
    indexes: { conversationId: string };
  };
  generations: {
    key: string;
    value: Generation;
    indexes: { artifactId: string; "artifact-version": [string, number] };
  };
  working: { key: string; value: WorkingDocument };
  meta: {
    key: string;
    value: { key: string; revision: number; activeArtifactId: string | null };
  };
}
const stores = [
  "projects",
  "conversations",
  "artifacts",
  "generations",
  "working",
  "meta",
] as const;
export type Write = IDBPTransaction<WorkspaceDB, typeof stores, "readwrite">;
export class WorkspaceStorage {
  private db: Promise<IDBPDatabase<WorkspaceDB>>;
  constructor(name = "ii-studio-workspace") {
    this.db = openDB<WorkspaceDB>(name, 1, {
      upgrade(db, oldVersion) {
        // Add future migrations here. Never clear existing stores on upgrade.
        if (oldVersion < 1) {
          db.createObjectStore("projects", { keyPath: "id" });
          db.createObjectStore("conversations", { keyPath: "id" }).createIndex(
            "projectId",
            "projectId",
          );
          db.createObjectStore("artifacts", { keyPath: "id" }).createIndex(
            "conversationId",
            "conversationId",
          );
          const g = db.createObjectStore("generations", { keyPath: "id" });
          g.createIndex("artifactId", "artifactId");
          g.createIndex("artifact-version", ["artifactId", "version"], {
            unique: true,
          });
          db.createObjectStore("working", { keyPath: "generationId" });
          db.createObjectStore("meta", { keyPath: "key" });
        }
      },
      blocked() {
        console.warn("Close other II studio tabs to update local storage.");
      },
      blocking: () => {
        void this.db.then((db) => db.close());
      },
    });
  }
  async index(): Promise<Index> {
    const db = await this.db;
    const tx = db.transaction(stores, "readonly");
    const [projects, conversations, artifacts, meta] = await Promise.all([
      tx.objectStore("projects").getAll(),
      tx.objectStore("conversations").getAll(),
      tx.objectStore("artifacts").getAll(),
      tx.objectStore("meta").get("workspace"),
    ]);
    // Validate metadata before exposing it; leave corrupt records untouched for recovery.
    return {
      projects: projects.map((p) => projectSchema.parse(p)),
      conversations: conversations.map((c) => conversationSchema.parse(c)),
      artifacts: artifacts.map((a) => artifactSchema.parse(a)),
      revision: meta?.revision ?? 0,
      activeArtifactId: meta?.activeArtifactId ?? null,
    };
  }
  async load(id: string): Promise<LoadedArtifact> {
    const db = await this.db;
    const tx = db.transaction(
      ["artifacts", "generations", "working"],
      "readonly",
    );
    const artifact = artifactSchema.parse(
      await tx.objectStore("artifacts").get(id),
    );
    const generations = (
      await tx.objectStore("generations").index("artifactId").getAll(id)
    )
      .map((g) => generationSchema.parse(g))
      .sort((a, b) => b.version - a.version);
    const working = (
      await Promise.all(
        generations.map((g) => tx.objectStore("working").get(g.id)),
      )
    )
      .filter((w): w is WorkingDocument => !!w)
      .map((w) => workingSchema.parse(w));
    if (
      !generations.some((g) => g.id === artifact.activeGenerationId) ||
      !generations.some((g) => g.id === artifact.latestGenerationId)
    )
      throw new Error("This creation has a missing saved version.");
    for (const g of generations)
      if (
        g.type !== artifact.type ||
        (g.parentGenerationId &&
          !generations.some(
            (p) => p.id === g.parentGenerationId && p.version < g.version,
          ))
      )
        throw new Error("This creation has inconsistent version history.");
    return { artifact, generations, working };
  }
  async write(
    revision: number,
    action: (tx: Write) => Promise<void>,
  ): Promise<number> {
    const db = await this.db;
    const tx = db.transaction(stores, "readwrite");
    try {
      const meta = (await tx.objectStore("meta").get("workspace")) ?? {
        key: "workspace",
        revision: 0,
        activeArtifactId: null,
      };
      if (meta.revision !== revision)
        throw new Error(
          "Another tab changed your workspace. Reload saved work before continuing.",
        );
      await action(tx);
      const next = (await tx.objectStore("meta").get("workspace")) ?? meta;
      await tx.objectStore("meta").put({ ...next, revision: revision + 1 });
      await tx.done;
      return revision + 1;
    } catch (e) {
      try {
        tx.abort();
      } catch {}
      await tx.done.catch(() => {});
      throw e;
    }
  }
  async backup() {
    const db = await this.db;
    const tx = db.transaction(stores, "readonly");
    const [projects, conversations, artifacts, generations, working] =
      await Promise.all([
        tx.objectStore("projects").getAll(),
        tx.objectStore("conversations").getAll(),
        tx.objectStore("artifacts").getAll(),
        tx.objectStore("generations").getAll(),
        tx.objectStore("working").getAll(),
      ]);
    return {
      format: "ii-studio-backup" as const,
      formatVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      projects,
      conversations,
      artifacts,
      generations,
      working,
    };
  }
  async close() {
    (await this.db).close();
  }
}
export async function removeArtifacts(tx: Write, ids: string[]) {
  for (const id of ids) {
    const generations = await tx
      .objectStore("generations")
      .index("artifactId")
      .getAll(id);
    for (const g of generations) {
      await tx.objectStore("working").delete(g.id);
      await tx.objectStore("generations").delete(g.id);
    }
    await tx.objectStore("artifacts").delete(id);
  }
  const meta = await tx.objectStore("meta").get("workspace");
  if (meta?.activeArtifactId && ids.includes(meta.activeArtifactId))
    await tx.objectStore("meta").put({ ...meta, activeArtifactId: null });
}

/** Generation and ownership pointers commit together; existing versions are immutable. */
export async function persistGeneration(
  tx: Write,
  conversation: Conversation,
  artifact: Artifact,
  generation: Generation,
) {
  conversationSchema.parse(conversation);
  artifactSchema.parse(artifact);
  generationSchema.parse(generation);
  const current = await tx.objectStore("artifacts").get(artifact.id);
  const latest = current
    ? await tx.objectStore("generations").get(current.latestGenerationId)
    : null;
  if (generation.version !== (latest?.version ?? 0) + 1)
    throw new Error(
      "A newer version was saved. Reopen this creation before refining it.",
    );
  if (
    generation.artifactId !== artifact.id ||
    artifact.type !== generation.type ||
    artifact.activeGenerationId !== generation.id ||
    artifact.latestGenerationId !== generation.id
  )
    throw new Error("Inconsistent generation ownership.");
  if (generation.parentGenerationId) {
    const parent = await tx
      .objectStore("generations")
      .get(generation.parentGenerationId);
    if (
      !parent ||
      parent.artifactId !== artifact.id ||
      parent.version >= generation.version
    )
      throw new Error("The refinement's base version is missing.");
  } else if (current)
    throw new Error("An existing creation needs a refinement base.");
  if (
    conversation.projectId &&
    !(await tx.objectStore("projects").get(conversation.projectId))
  )
    throw new Error("This project no longer exists.");
  if (conversation.projectId) {
    const project = await tx.objectStore("projects").get(conversation.projectId);
    if (project) await tx.objectStore("projects").put({ ...project, updatedAt: generation.completedAt });
  }
  const existingConversation = await tx
    .objectStore("conversations")
    .get(conversation.id);
  await tx
    .objectStore("conversations")
    .put(
      existingConversation
        ? { ...existingConversation, updatedAt: conversation.updatedAt }
        : conversation,
    );
  await tx
    .objectStore("artifacts")
    .put(
      current
        ? {
            ...current,
            activeGenerationId: generation.id,
            latestGenerationId: generation.id,
            updatedAt: artifact.updatedAt,
          }
        : artifact,
    );
  await tx.objectStore("generations").add(generation);
  const meta = await tx.objectStore("meta").get("workspace");
  await tx
    .objectStore("meta")
    .put({
      key: "workspace",
      revision: meta?.revision ?? 0,
      activeArtifactId: artifact.id,
    });
}

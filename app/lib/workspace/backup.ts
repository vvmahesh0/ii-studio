import { z } from "zod";
import {
  artifactSchema,
  projectSchema,
  conversationSchema,
  generationSchema,
  workingSchema,
} from "./model.ts";
export const backupSchema = z
  .object({
    format: z.literal("ii-studio-backup"),
    formatVersion: z.literal(1),
    exportedAt: z.string().datetime(),
    projects: z.array(projectSchema).max(5000),
    conversations: z.array(conversationSchema).max(10000),
    artifacts: z.array(artifactSchema).max(20000),
    generations: z.array(generationSchema).max(50000),
    working: z.array(workingSchema).max(50000),
  })
  .strict();
export type Backup = z.infer<typeof backupSchema>;
export function validateBackup(value: unknown): Backup {
  const b = backupSchema.parse(value);
  for (const entries of [
    b.projects,
    b.conversations,
    b.artifacts,
    b.generations,
    b.working,
  ]) {
    const ids = entries.map((e) => ("id" in e ? e.id : e.generationId));
    if (new Set(ids).size !== ids.length)
      throw new Error("The backup contains duplicate record IDs.");
  }
  const projects = new Set(b.projects.map((p) => p.id));
  const conversations = new Map(b.conversations.map((c) => [c.id, c]));
  const artifacts = new Map(b.artifacts.map((a) => [a.id, a]));
  const generations = new Map(b.generations.map((g) => [g.id, g]));
  const versions = new Set<string>();
  for (const c of b.conversations)
    if (c.projectId && !projects.has(c.projectId))
      throw new Error("A conversation's project is missing.");
  for (const a of b.artifacts) {
    if (!conversations.has(a.conversationId))
      throw new Error("An artifact's conversation is missing.");
    for (const id of [a.activeGenerationId, a.latestGenerationId])
      if (generations.get(id)?.artifactId !== a.id)
        throw new Error("An artifact's saved version is missing.");
    const latest = generations.get(a.latestGenerationId)!;
    if (
      b.generations.some(
        (g) => g.artifactId === a.id && g.version > latest.version,
      )
    )
      throw new Error("The latest version reference is inconsistent.");
  }
  for (const g of b.generations) {
    if (artifacts.get(g.artifactId)?.type !== g.type)
      throw new Error("A generation's artifact type is inconsistent.");
    const key = JSON.stringify([g.artifactId, g.version]);
    if (versions.has(key)) throw new Error("Duplicate version numbers.");
    versions.add(key);
    const parent = g.parentGenerationId
      ? generations.get(g.parentGenerationId)
      : null;
    if (
      g.parentGenerationId &&
      (!parent ||
        parent.artifactId !== g.artifactId ||
        parent.version >= g.version)
    )
      throw new Error("A generation's parent reference is invalid.");
  }
  for (const w of b.working)
    if (generations.get(w.generationId)?.type !== "flowchart")
      throw new Error("A working flowchart's generation is missing.");
  return b;
}
export function mergeBackup(
  incoming: Backup,
  existing: Backup,
  uuid: () => string = () => crypto.randomUUID(),
): Backup {
  const pairs = [
    "projects",
    "conversations",
    "artifacts",
    "generations",
    "working",
  ] as const;
  const collision = pairs.some((key) =>
    incoming[key].some((record) => {
      const recordId = "id" in record ? record.id : record.generationId;
      const found = existing[key].find(
        (e) => ("id" in e ? e.id : e.generationId) === recordId,
      );
      return found && JSON.stringify(found) !== JSON.stringify(record);
    }),
  );
  if (!collision)
    return {
      ...incoming,
      ...Object.fromEntries(
        pairs.map((key) => [
          key,
          incoming[key].filter(
            (record) =>
              !existing[key].some(
                (e) =>
                  ("id" in e ? e.id : e.generationId) ===
                  ("id" in record ? record.id : record.generationId),
              ),
          ),
        ]),
      ),
    } as Backup;
  // A conflicting imported graph is kept as a separate copy. Remap the entire
  // imported hierarchy so no child can accidentally attach to existing work.
  const ids = new Map<string, string>();
  for (const key of pairs)
    for (const item of incoming[key])
      if ("id" in item) ids.set(item.id, uuid());
  const id = (value: string) => ids.get(value)!;
  return {
    ...incoming,
    projects: incoming.projects.map((p) => ({ ...p, id: id(p.id) })),
    conversations: incoming.conversations.map((c) => ({
      ...c,
      id: id(c.id),
      projectId: c.projectId ? id(c.projectId) : null,
    })),
    artifacts: incoming.artifacts.map((a) => ({
      ...a,
      id: id(a.id),
      conversationId: id(a.conversationId),
      activeGenerationId: id(a.activeGenerationId),
      latestGenerationId: id(a.latestGenerationId),
    })),
    generations: incoming.generations.map((g) => ({
      ...g,
      id: id(g.id),
      artifactId: id(g.artifactId),
      parentGenerationId: g.parentGenerationId
        ? id(g.parentGenerationId)
        : null,
    })),
    working: incoming.working.map((w) => ({
      ...w,
      generationId: id(w.generationId),
    })),
  };
}

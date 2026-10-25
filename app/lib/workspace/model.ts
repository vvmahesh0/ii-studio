import { MAX_PROMPT_CHARACTERS } from "../prompt-limits.ts";
import { z } from "zod";
import { diagramSchema, type FlowSnapshot } from "../flowchart/contract.ts";

const id = z.string().min(1).max(100);
const date = z.string().datetime();
const name = z.string().trim().min(1).max(180);
export const projectSchema = z
  .object({ id, name, createdAt: date, updatedAt: date })
  .strict();
export const conversationSchema = z
  .object({
    id,
    projectId: id.nullable(),
    title: name,
    createdAt: date,
    updatedAt: date,
  })
  .strict();
export const artifactSchema = z
  .object({
    id,
    conversationId: id,
    type: z.enum(["interface", "flowchart"]),
    title: name,
    originalPrompt: z.string().min(1).max(MAX_PROMPT_CHARACTERS),
    createdAt: date,
    updatedAt: date,
    activeGenerationId: id,
    latestGenerationId: id,
  })
  .strict();
const point = z
  .object({ x: z.number().finite(), y: z.number().finite() })
  .strict();
export const snapshotSchema = z
  .object({
    document: diagramSchema,
    positions: z.record(z.string(), point),
    routes: z
      .record(
        z.string(),
        z.object({
          points: z.array(point).max(100),
          label: z
            .object({
              x: z.number().finite(),
              y: z.number().finite(),
              width: z.number().finite(),
              height: z.number().finite(),
            })
            .optional(),
        }),
      )
      .optional(),
    routeKey: z.string().optional(),
    viewport: z
      .object({
        x: z.number().finite(),
        y: z.number().finite(),
        zoom: z.number().positive().max(100),
        initialized: z.boolean().optional(),
      })
      .strict(),
  })
  .strict();
const common = {
  id,
  artifactId: id,
  version: z.number().int().positive(),
  parentGenerationId: id.nullable(),
  instruction: z.string().min(1).max(MAX_PROMPT_CHARACTERS),
  createdAt: date,
  completedAt: date,
  schemaVersion: z.literal(1),
  clarification: z
    .object({ question: z.string().max(500), answer: z.string().max(1000) })
    .strict()
    .optional(),
};
export const generationSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...common,
      type: z.literal("interface"),
      theme: z.enum(["default", "modern"]),
      revision: z.string().max(100),
      program: z.string().min(1).max(300000),
      refinement: z
        .object({
          kind: z.literal("selection"),
          targetId: z.string().min(1).max(2000),
          component: z.string().min(1).max(100),
          parentId: z.string().min(1).max(2000).optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("flowchart"),
      snapshot: snapshotSchema,
    })
    .strict(),
]);
export const workingSchema = z
  .object({ generationId: id, snapshot: snapshotSchema, updatedAt: date })
  .strict();
export type Project = z.infer<typeof projectSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type Generation = z.infer<typeof generationSchema>;
export type WorkingDocument = z.infer<typeof workingSchema>;
export type Mode = Artifact["type"];
export type Content =
  | {
      type: "interface";
      theme: "default" | "modern";
      revision: string;
      program: string;
      refinement?: {
        kind: "selection";
        targetId: string;
        component: string;
        parentId?: string;
      };
    }
  | { type: "flowchart"; snapshot: FlowSnapshot };
export type Index = {
  projects: Project[];
  conversations: Conversation[];
  artifacts: Artifact[];
  revision: number;
  activeArtifactId: string | null;
};
export type LoadedArtifact = {
  artifact: Artifact;
  generations: Generation[];
  working: WorkingDocument[];
};
export type Session = {
  key: string;
  loaded: LoadedArtifact | null;
  theme?: "default" | "modern";
  draft?: string;
};
/** Local naming: no extra model request and no changes to saved instructions. */
export function shortTitle(value: string) {
  return (
    value.trim().replace(/\s+/g, " ").split(" ").slice(0, 5).join(" ") ||
    "Untitled creation"
  );
}
export function localTitle(prompt: string) {
  const title = prompt
    .trim()
    .replace(
      /^(please\s+)?(create|build|design|generate|make|show me)\s+(me\s+)?(a|an|the)?\s*/i,
      "",
    )
    .replace(/^(a|an|the)\s+/i, "")
    .replace(
      /^(beautiful|polished|clean|compact|desktop|responsive|premium|modern)\s+/gi,
      "",
    )
    .split(/\s+(?:with|using|including|featuring|for)\s+|[\n.!?:]/i)[0]
    .trim();
  const result = shortTitle(title);
  return result[0].toUpperCase() + result.slice(1);
}
export const emptyIndex = (): Index => ({
  projects: [],
  conversations: [],
  artifacts: [],
  revision: 0,
  activeArtifactId: null,
});

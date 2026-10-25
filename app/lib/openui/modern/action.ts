import { z } from "zod";
// External/backend actions are intentionally not part of the local preview contract.
export const actionSchema = z
  .object({ type: z.literal("continue_conversation") })
  .optional();
export type ActionSchema = z.infer<typeof actionSchema>;

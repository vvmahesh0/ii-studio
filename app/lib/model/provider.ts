import { generateSystemPrompt } from "@openuidev/lang-core";
import { getThemeContract } from "../openui/themes/server";
import { flowInstructions } from "../flowchart/prompt";
import { localProvider, cliReady, CliWorker } from "./cli";
type Profile = "default" | "modern" | "flowchart";
export async function prepareModel(profile: Profile) {
  if (localProvider() !== "antigravity") {
    await cliReady();
    return;
  }
  const { getWarmWorker } = await import("../openui/gemini-worker");
  await getWarmWorker(profile);
}
export async function beginGeneration(
  _request: Request,
  profile: Profile,
  _action: "generate" | "refine" | "targeted",
) {
  void _request;
  void _action;
  const local = await import("../openui/gemini-worker");
  if (!local.reserveGeneration())
    throw new Error("A generation is running. Wait or stop it first.");
  return {
    getWorker: async () => {
      const selected = localProvider();
      if (selected === "antigravity") return local.getWarmWorker(profile);
      await cliReady();
      const instructions =
        profile === "flowchart"
          ? flowInstructions
          : generateSystemPrompt({
              library: getThemeContract(profile).spec,
              promptOptions: getThemeContract(profile).promptOptions,
            });
      return new CliWorker(selected, instructions);
    },
    complete: async () => {},
    finish: async (_outcome?: string, _metrics?: unknown) => {
      void _outcome;
      void _metrics;
      local.releaseGeneration();
    },
  };
}

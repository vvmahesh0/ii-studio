import { graphIssues } from "../flowchart/contract.ts";
import type { Generation, LoadedArtifact } from "./model.ts";
export async function validateGeneration(g: Generation) {
  if (g.type === "flowchart") {
    const errors = graphIssues(g.snapshot.document);
    if (errors.length)
      throw new Error(`Saved flowchart is invalid: ${errors[0]}`);
  } else {
    // Lazy: do not ship another parser/catalog on the initial creation path.
    const { getThemeContract } = await import("../openui/themes/server");
    const contract = getThemeContract(g.theme);
    if (contract.revision !== g.revision)
      throw new Error(
        "This saved interface uses an unsupported component-library version. Its saved data has been kept.",
      );
    if (!contract.inspect(g.program).valid)
      throw new Error(
        "This saved interface contains unsupported component settings. Its saved data has been kept.",
      );
  }
}
export async function validateLoadedArtifact(loaded: LoadedArtifact) {
  const selected = loaded.generations.find(
    (g) => g.id === loaded.artifact.activeGenerationId,
  );
  if (!selected) throw new Error("The selected saved version is missing.");
  await validateGeneration(selected);
}

import { FlowRecordStream } from "./stream.ts";
import { connectedPreview, type Diagram } from "./contract.ts";
/** Exactly one correction; clarification remains a valid alternative response. */
export async function generateFlowWithCorrection(
  instruction: string,
  generate: (
    prompt: string,
    onDelta: (text: string) => void,
  ) => Promise<string>,
  onPreview: (document: Diagram) => void = () => {},
  onCorrection: () => void = () => {},
) {
  let prompt = instruction;
  let previewSent = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    let output = "";
    const stream = new FlowRecordStream((d) => {
      if (!previewSent) {
        const part = connectedPreview(d);
        if (part) {
          previewSent = true;
          onPreview(part);
        }
      }
    });
    const final = await generate(prompt, (delta) => {
      output += delta;
      stream.push(delta);
    });
    const checked = new FlowRecordStream();
    checked.push(final || output);
    const result = checked.finish();
    if (!result.errors.length) return { ...result, corrections: attempt };
    if (attempt === 0) {
      onCorrection();
      prompt = `Correct this flowchart response using the registered NDJSON contract. Return the entire graph or one clarification for a missing material policy. Preserve requested steps, conditions, outcomes and stable IDs.\nOriginal request data: ${instruction}\nValidation errors: ${JSON.stringify(result.errors.slice(0, 12))}\nInvalid response data: ${JSON.stringify(final || output)}`;
    }
  }
  throw new Error(
    "The model could not produce a connected, valid diagram. Retry or simplify the requirement; your previous version is preserved.",
  );
}

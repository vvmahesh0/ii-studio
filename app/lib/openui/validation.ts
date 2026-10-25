import {
  createParser,
  type LibraryJSONSchema,
  type LibrarySpec,
} from "@openuidev/lang-core";
import generated from "./generated/spec.json";
import { cleanProgram, hasUsefulContent } from "./protocol";

export const librarySpec = generated as unknown as LibrarySpec;
export const componentNames = Object.keys(generated.components);
export const parser = createParser(
  generated.schema as unknown as LibraryJSONSchema,
  "Col",
);

export function inspectProgram(text: string) {
  const program = cleanProgram(text);
  const result = parser.parse(program);
  const errors = result.meta.errors.map((error) => error.message);
  if (result.meta.unresolved.length)
    errors.push(`Unresolved pieces: ${result.meta.unresolved.join(", ")}`);
  if (result.meta.incomplete)
    errors.push("The screen definition is incomplete.");
  if (!hasUsefulContent(result.root))
    errors.push("No visible widget content was generated.");
  return { program, result, errors, valid: errors.length === 0 };
}

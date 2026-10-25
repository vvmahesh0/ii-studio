import {
  createParser,
  type LibraryJSONSchema,
  type LibrarySpec,
} from "@openuidev/lang-core";
import { blockConfigurationIssues } from "../modern/blocks/validation";
import defaultSpec from "../generated/spec.json";
import modernSpec from "../modern/generated/spec.json";
import { promptOptions as defaultOptions } from "../prompt-options";
import { promptOptions as modernOptions } from "../modern/prompt-options";
import { cleanProgram, hasUsefulContent } from "../protocol";
import { applyComponentAliases } from "../fallback";
import { themeInfo, type ThemeId } from "./types";
const specs = { default: defaultSpec, modern: modernSpec };
const parsers = {
  default: createParser(
    defaultSpec.schema as unknown as LibraryJSONSchema,
    "Col",
  ),
  modern: createParser(
    modernSpec.schema as unknown as LibraryJSONSchema,
    "Page",
  ),
};
export function getThemeContract(theme: ThemeId) {
  const spec = specs[theme];
  const parser = parsers[theme];
  return {
    ...themeInfo[theme],
    theme,
    spec: spec as unknown as LibrarySpec,
    parser,
    promptOptions: theme === "default" ? defaultOptions : modernOptions,
    aliases:
      theme === "default" ? applyComponentAliases : (text: string) => text,
    correction:
      theme === "default"
        ? "IconButton variants are outline, ghost, solid. Soft is a Card variant."
        : "Root is Page. Card takes children, title, description, optional tone. Blocks: AppShell(brand,navigation,title,children,user), MetricCards(items,highlightedId), DashboardSection(children,title,description,actions), AuthLayout(mode,brand,children,title,description,supportingText). Navigation group/item ids and metric ids must be unique. Use Column for vertical layout and TableColumn for table definitions. Button uses default, not solid. Never rename Heading to Title or Separator to Divider.",
    inspect(text: string) {
      const program = cleanProgram(text);
      const result = parser.parse(program);
      const errors = result.meta.errors.map((e) => e.message);
      if (theme === "modern")
        errors.push(...blockConfigurationIssues(result.root));
      if (result.meta.unresolved.length)
        errors.push(`Unresolved pieces: ${result.meta.unresolved.join(", ")}`);
      if (result.meta.incomplete)
        errors.push("The screen definition is incomplete.");
      if (!hasUsefulContent(result.root, 300, theme))
        errors.push("No visible interface content was generated.");
      return { program, result, errors, valid: errors.length === 0 };
    },
  };
}

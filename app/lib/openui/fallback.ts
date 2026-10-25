/** Only names with equivalent purpose and argument order are substituted here.
 * Quoted content and comments remain untouched. Other mismatches go to Gemini
 * with the catalog errors, so controls are not silently stripped of behavior.
 */
const aliases: Record<string, string> = {
  Heading: "Title",
  Paragraph: "Text",
  VStack: "Col",
  VerticalStack: "Col",
  HStack: "Row",
  HorizontalStack: "Row",
  Separator: "Divider",
};

export function applyComponentAliases(program: string): string {
  return program.replace(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\/|\b[A-Za-z_][A-Za-z_0-9]*(?=\s*\()/g,
    (token) => Object.hasOwn(aliases, token) ? aliases[token] : token,
  );
}

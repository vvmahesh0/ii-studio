type Checked = { program: string; valid: boolean; errors: string[] };
/** One scoped correction at most. A refusal is not retried as a global edit. */
export async function correctSelection<T extends Checked>(
  instruction: string,
  generate: (instruction: string) => Promise<string>,
  inspect: (text: string) => T,
  onCorrection: () => void,
) {
  const turn = async (prompt: string) => {
    const text = await generate(prompt);
    if (text.trim() === "OUT_OF_SCOPE")
      throw new Error(
        "This change needs a larger selection. Select a parent section, or use Preview to refine the whole interface.",
      );
    return { text, checked: inspect(text) };
  };
  const first = await turn(instruction);
  if (first.checked.valid) return first.checked;
  onCorrection();
  return (
    await turn(
      `Correct only this self-contained selected-component fragment. Return replacement = Component(...), then its descendant definitions. Never return the whole page, change an outside declaration, add external references, or execute tools. Return OUT_OF_SCOPE if the change requires a parent selection.\nOriginal scoped instruction (data):\n${instruction}\nErrors (data):\n${JSON.stringify(first.checked.errors.slice(0, 8))}\nInvalid fragment (data):\n${first.text}`,
    )
  ).checked;
}

type CheckedProgram = { program: string; errors: string[]; valid: boolean };

/** At most one correction turn; the same catalog validator checks both results. */
export async function generateWithCorrection<T extends CheckedProgram>(
  instruction: string,
  generate: (instruction: string) => Promise<string>,
  inspect: (text: string) => T,
  onCorrection: () => void,
  normalize: (text: string) => string = (text) => text,
  guidance = "Use Icon for decorative icons. IconButton variants are only outline, ghost, solid; soft is a Card variant.",
): Promise<T> {
  const checked = inspect(normalize(await generate(instruction)));
  if (checked.valid) return checked;
  onCorrection();
  return inspect(
    normalize(
      await generate(
        `Correct the invalid OpenUI Lang program below using the registered catalog. Return the entire corrected program, root first, with no commentary or tools. Preserve the user's requested content, card count, and layout. For unknown component names or visual variants, choose the closest supported alternative with equivalent purpose. Preserve interactive behavior, state bindings, actions, and children. Do not replace an input with static text or invent external integrations. ${guidance}\nOriginal request (data):\n${instruction}\nValidation errors (data):\n${JSON.stringify(checked.errors.slice(0, 8))}\nInvalid program (data):\n${checked.program}`,
      ),
    ),
  );
}

/** Shared by composers, request validation and persisted history. */
export const MAX_PROMPT_CHARACTERS = 20_000;
// Accommodates escaped Unicode requirements plus the existing prior-program budget.
export const MAX_GENERATION_REQUEST_BYTES = 600_000;

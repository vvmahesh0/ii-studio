export function publicFailure(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "The model is unavailable. Your saved work is safe.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

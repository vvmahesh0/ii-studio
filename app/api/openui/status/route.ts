import { allowedOrigin } from "@/app/lib/openui/request";
import { getThemeContract } from "@/app/lib/openui/themes/server";
import { isThemeId } from "@/app/lib/openui/themes/types";
import { requestText } from "@/app/lib/model/request-body";
import { prepareModel } from "@/app/lib/model/provider";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!allowedOrigin(request))
    return Response.json({ error: "Not allowed." }, { status: 403 });
  try {
    const read = await requestText(request, 2048);
    if (read instanceof Response) return read;
    const raw = read;
    if (raw.length > 2048)
      return Response.json({ error: "Request too large." }, { status: 413 });
    let body;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return Response.json({ error: "Send a valid request." }, { status: 400 });
    }
    const theme = body?.theme ?? "default";
    if (!isThemeId(theme))
      return Response.json(
        { error: "Choose Default or Modern." },
        { status: 400 },
      );
    const contract = getThemeContract(theme);
    await prepareModel(theme);
    return Response.json(
      {
        ready: true,
        model: "AI connected",
        theme,
        revision: contract.revision,
        components: Object.keys(contract.spec.components),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not connect to Gemini.",
      },
      { status: 503 },
    );
  }
}

import { allowedOrigin } from "@/app/lib/openui/request";
import { requestText } from "@/app/lib/model/request-body";
import {
  providers,
  executableFor,
  selection,
  selectProvider,
  type Provider,
} from "@/app/lib/model/cli";
import {
  reserveGeneration,
  releaseGeneration,
} from "@/app/lib/openui/gemini-worker";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!allowedOrigin(request))
    return Response.json({ error: "Not allowed." }, { status: 403 });
  const raw = await requestText(request, 2048);
  if (raw instanceof Response) return raw;
  let body;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return Response.json(
      { error: "Send a connection request." },
      { status: 400 },
    );
  if (body.provider !== undefined) {
    if (
      !providers.includes(body.provider) ||
      typeof body.model !== "string" ||
      !/^(?:[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,99})?$/.test(body.model)
    )
      return Response.json(
        { error: "Choose a supported provider and model ID." },
        { status: 400 },
      );
    if (!reserveGeneration())
      return Response.json(
        { error: "Stop the current generation before changing providers." },
        { status: 409 },
      );
    try {
      await executableFor(body.provider as Provider);
      selectProvider(body.provider, body.model);
    } catch {
      return Response.json(
        {
          error:
            "CLI not installed. Configure its executable path in .env.local.",
        },
        { status: 400 },
      );
    } finally {
      releaseGeneration();
    }
  }
  const options = await Promise.all(
    providers.map(async (id) => ({
      id,
      installed: await executableFor(id).then(
        () => true,
        () => false,
      ),
    })),
  );
  return Response.json(
    {
      selected: selection(),
      options,
      effectiveModel:
        selection().model ||
        (selection().provider === "antigravity"
          ? process.env.MOSAIC_GEMINI_MODEL || "gemini-3.8-flash-low"
          : ""),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

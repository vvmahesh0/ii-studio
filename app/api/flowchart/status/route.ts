import { allowedOrigin } from "@/app/lib/openui/request";
import { prepareModel } from "@/app/lib/model/provider";
import { FLOW_REVISION } from "@/app/lib/flowchart/contract";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!allowedOrigin(request))
    return Response.json({ error: "Not allowed." }, { status: 403 });
  try {
    await prepareModel("flowchart");
    return Response.json(
      {
        ready: true,
        revision: FLOW_REVISION,
        model: "AI connected",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Could not connect to Gemini.",
      },
      { status: 503 },
    );
  }
}

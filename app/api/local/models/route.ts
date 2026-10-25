import { allowedOrigin } from "@/app/lib/openui/request";
import { requestText } from "@/app/lib/model/request-body";
import { providers, type Provider } from "@/app/lib/model/cli";
import { modelCatalog } from "@/app/lib/model/catalog";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!allowedOrigin(request)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const raw = await requestText(request, 512);
  if (raw instanceof Response) return raw;
  let body;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object" || !providers.includes(body.provider)) return Response.json({ error: "Choose a supported provider." }, { status: 400 });
  return Response.json(await modelCatalog(body.provider as Provider), { headers: { "Cache-Control": "no-store" } });
}

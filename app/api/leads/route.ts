import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });

  // TODO: Persist and deliver in production. Suggested integrations: Supabase + Resend.
  // UTM fields are accepted here so attribution can be stored with the lead.
  const normalizeUTM = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    return trimmed.length > 100 ? undefined : trimmed;
  };

  console.log("lead_capture", {
    utm_source: normalizeUTM(body?.utm_source),
    utm_medium: normalizeUTM(body?.utm_medium),
    utm_campaign: normalizeUTM(body?.utm_campaign),
    utm_content: normalizeUTM(body?.utm_content)
  });
  return NextResponse.json({ ok: true });
}

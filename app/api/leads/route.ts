import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });

  // TODO: Persist and deliver in production. Suggested integrations: Supabase + Resend.
  // UTM fields are accepted here so attribution can be stored with the lead.
  const truncateUTM = (value: unknown): string | undefined => {
    if (typeof value !== "string" || value === "") return undefined;
    return value.length > 100 ? undefined : value;
  };

  console.log("lead_capture", {
    utm_source: truncateUTM(body?.utm_source),
    utm_medium: truncateUTM(body?.utm_medium),
    utm_campaign: truncateUTM(body?.utm_campaign),
    utm_content: truncateUTM(body?.utm_content)
  });
  return NextResponse.json({ ok: true });
}

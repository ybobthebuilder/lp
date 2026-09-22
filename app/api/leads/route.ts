import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });

  // TODO: Persist and deliver in production. Suggested integrations: Supabase + Resend.
  // UTM fields are accepted here so attribution can be stored with the lead.
  console.log("lead_capture", { email, utm_source: body?.utm_source, utm_medium: body?.utm_medium, utm_campaign: body?.utm_campaign, utm_content: body?.utm_content });
  return NextResponse.json({ ok: true });
}

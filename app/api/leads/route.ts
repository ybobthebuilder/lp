import { NextResponse } from "next/server";
import { CONSENT_TEXT_VERSION } from "../../consent-version";
import { captureLead } from "../../supabase-capture";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const email = str(body?.email);
  const whatsapp = str(body?.whatsapp);
  const idempotencyKey = str(body?.idempotency_key);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  if (!/^\+?[\d\s().-]{8,20}$/.test(whatsapp)) return NextResponse.json({ error: "WhatsApp inválido" }, { status: 400 });
  if (body?.consent_email !== true || body?.consent_whatsapp !== true) return NextResponse.json({ error: "Consentimento obrigatório" }, { status: 400 });
  if (!UUID.test(idempotencyKey)) return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });

  // UTM fields are accepted here so attribution can be stored with the lead.
  const normalizeUTM = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    return trimmed.length > 100 ? undefined : trimmed;
  };
  const utm: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
    const value = normalizeUTM(body?.[key]);
    if (value) utm[key] = value;
  }

  // New and existing emails get the same response (no enumeration). No lead data is logged.
  const ok = await captureLead({ email, whatsapp, textVersion: CONSENT_TEXT_VERSION, utm, idempotencyKey }).catch(() => false);
  if (!ok) return NextResponse.json({ error: "Não foi possível enviar agora" }, { status: 502 });
  return NextResponse.json({ ok: true });
}

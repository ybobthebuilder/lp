import { NextResponse } from "next/server";
import { CONSENT_TEXT_VERSION } from "../../consent-version";
import { captureLead } from "../../supabase-capture";

// Same rule as the DB check on contacts.whatsapp (supabase/migrations/20261012030000_crm_core.sql:13).
export const DB_WHATSAPP_RE = /^\+55\d{10,11}$/;

// Strip non-digits; 10-11 digits get the 55 prefix; 12-13 digits starting with 55 are kept.
export function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let full: string;
  if (digits.length === 10 || digits.length === 11) full = "55" + digits;
  else if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) full = digits;
  else return null;
  const value = "+" + full;
  return DB_WHATSAPP_RE.test(value) ? value : null;
}

// Generic invalid-input response. Also used when capture_lead refuses (LP001), so the
// response never reveals that an email or number is already registered (TASK-T7f).
const invalidRequest = () => NextResponse.json({ error: "Requisição inválida" }, { status: 400 });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const email = str(body?.email);
  const whatsapp = normalizeWhatsapp(str(body?.whatsapp));
  const idempotencyKey = str(body?.idempotency_key);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  if (!whatsapp) return NextResponse.json({ error: "WhatsApp inválido" }, { status: 400 });
  if (body?.consent_email !== true || body?.consent_whatsapp !== true) return NextResponse.json({ error: "Consentimento obrigatório" }, { status: 400 });
  if (!UUID.test(idempotencyKey)) return invalidRequest();

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
  const result = await captureLead({ email, whatsapp, textVersion: CONSENT_TEXT_VERSION, utm, idempotencyKey }).catch(() => "error" as const);
  if (result === "refused") return invalidRequest();
  if (result !== "ok") return NextResponse.json({ error: "Não foi possível enviar agora" }, { status: 502 });
  return NextResponse.json({ ok: true });
}

import "server-only";

// Calls public.capture_lead (latest definition: supabase/migrations/20261012060000_crm_capture_refuse_cross.sql)
// via PostgREST. Env vars per docs/adr/0001-behavioral-crm.md:45 (server only).
export type CaptureInput = {
  email: string;
  whatsapp: string;
  textVersion: string;
  utm: Record<string, string>;
  idempotencyKey: string;
};

// "refused": capture_lead raised errcode LP001 (email and whatsapp belong to two different
// contacts, TASK-T7f). Only that exact PostgREST error code maps here; anything else is "error".
export type CaptureResult = "ok" | "refused" | "error";
export const REFUSE_CROSS_CODE = "LP001";

export async function captureLead(
  input: CaptureInput,
  fetchImpl: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env
): Promise<CaptureResult> {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return "error";
  // ADR L46: the secret key goes in the apikey header, not Authorization: Bearer.
  const res = await fetchImpl(`${url.replace(/\/+$/, "")}/rest/v1/rpc/capture_lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({
      p_email: input.email,
      p_whatsapp: input.whatsapp,
      p_consent_text_version: input.textVersion,
      p_lead_magnet_slug: null,
      p_utm: input.utm,
      p_idempotency_key: input.idempotencyKey
    }),
    cache: "no-store"
  });
  if (res.ok) return "ok";
  const body: unknown = await res.json().catch(() => null);
  const code = body && typeof body === "object" ? (body as { code?: unknown }).code : undefined;
  return code === REFUSE_CROSS_CODE ? "refused" : "error";
}

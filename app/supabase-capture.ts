import "server-only";

// Calls public.capture_lead (supabase/migrations/20261012050000_crm_capture_idempotent.sql:14-21)
// via PostgREST. Env vars per docs/adr/0001-behavioral-crm.md:45 (server only).
export type CaptureInput = {
  email: string;
  whatsapp: string;
  textVersion: string;
  utm: Record<string, string>;
  idempotencyKey: string;
};

export async function captureLead(
  input: CaptureInput,
  fetchImpl: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env
): Promise<boolean> {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return false;
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
  return res.ok;
}

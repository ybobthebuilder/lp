export type LeadPayload = Record<string, string | boolean>;

type Outcome = "ok" | "retry" | "stop";

// ok = accepted; retry = network error or 5xx; stop = 4xx (or other non-retryable status).
async function attemptLead(payload: LeadPayload, fetchImpl: typeof fetch): Promise<Outcome> {
  try {
    const res = await fetchImpl("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) return "ok";
    return res.status >= 500 ? "retry" : "stop";
  } catch {
    return "retry";
  }
}

// Returns true only when the API accepted the lead. Network errors resolve to false.
export async function submitLead(payload: LeadPayload, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  return (await attemptLead(payload, fetchImpl)) === "ok";
}

// Retries only on network error or 5xx; a 4xx stops immediately.
// One form submission = one idempotency_key, reused on every retry of that submission.
export async function submitLeadOnce(
  payload: LeadPayload,
  { fetchImpl = fetch, attempts = 3, newKey = () => crypto.randomUUID() }: { fetchImpl?: typeof fetch; attempts?: number; newKey?: () => string } = {}
): Promise<boolean> {
  const withKey = { ...payload, idempotency_key: newKey() };
  for (let i = 0; i < attempts; i++) {
    const outcome = await attemptLead(withKey, fetchImpl);
    if (outcome === "ok") return true;
    if (outcome === "stop") return false;
  }
  return false;
}

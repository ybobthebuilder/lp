export type LeadPayload = Record<string, string | boolean>;

// Returns true only when the API accepted the lead. Network errors resolve to false.
export async function submitLead(payload: LeadPayload, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return res.ok;
  } catch {
    return false;
  }
}

// One form submission = one idempotency_key, reused on every retry of that submission.
export async function submitLeadOnce(
  payload: LeadPayload,
  { fetchImpl = fetch, attempts = 3, newKey = () => crypto.randomUUID() }: { fetchImpl?: typeof fetch; attempts?: number; newKey?: () => string } = {}
): Promise<boolean> {
  const withKey = { ...payload, idempotency_key: newKey() };
  for (let i = 0; i < attempts; i++) {
    if (await submitLead(withKey, fetchImpl)) return true;
  }
  return false;
}

export type LeadPayload = Record<string, string>;

// Returns true only when the API accepted the lead. Network errors resolve to false.
export async function submitLead(payload: LeadPayload, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return res.ok;
  } catch {
    return false;
  }
}

import { describe, it, expect, vi } from "vitest";
import { submitLead } from "../lead-submit";

const payload = { email: "test@example.com", utm_source: "google" };

describe("submitLead", () => {
  it("returns true when the API responds ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    expect(await submitLead(payload, fetchMock)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/leads", expect.objectContaining({ method: "POST", body: JSON.stringify(payload) }));
  });

  it("returns false when the API responds 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 400 }));
    expect(await submitLead(payload, fetchMock)).toBe(false);
  });

  it("returns false when the API responds 500", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    expect(await submitLead(payload, fetchMock)).toBe(false);
  });

  it("returns false when the network fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await submitLead(payload, fetchMock)).toBe(false);
  });
});

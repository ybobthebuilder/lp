import { describe, it, expect, vi } from "vitest";
import { submitLead, submitLeadOnce } from "../lead-submit";

const payload = { email: "test@example.com", utm_source: "google" };

describe("submitLead", () => {
  it("returns true when the API responds ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    expect(await submitLead(payload, fetchMock)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/leads", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "Content-Type": "application/json" }), body: JSON.stringify(payload) }));
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

describe("submitLeadOnce", () => {
  const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);

  it("generates the idempotency_key once and reuses it on retries", async () => {
    const newKey = vi.fn().mockReturnValueOnce("key-1").mockReturnValue("key-2");
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("{}", { status: 502 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    expect(await submitLeadOnce(payload, { fetchImpl: fetchMock, newKey })).toBe(true);
    expect(newKey).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((c) => bodyOf(c).idempotency_key)).toEqual(["key-1", "key-1", "key-1"]);
  });

  it("uses a new key for a new submission", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response("{}", { status: 200 }));
    await submitLeadOnce(payload, { fetchImpl: fetchMock });
    await submitLeadOnce(payload, { fetchImpl: fetchMock });
    const [a, b] = fetchMock.mock.calls.map((c) => bodyOf(c).idempotency_key);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });

  it("stops immediately on 4xx (one call)", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response("{}", { status: 400 }));
    expect(await submitLeadOnce(payload, { fetchImpl: fetchMock })).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx reusing the same key", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response("{}", { status: 503 }));
    expect(await submitLeadOnce(payload, { fetchImpl: fetchMock, newKey: () => "k" })).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((c) => bodyOf(c).idempotency_key)).toEqual(["k", "k", "k"]);
  });

  it("gives up after the configured attempts", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response("{}", { status: 500 }));
    expect(await submitLeadOnce(payload, { fetchImpl: fetchMock, attempts: 2 })).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

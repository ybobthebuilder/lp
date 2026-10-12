import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));

import { POST, DB_WHATSAPP_RE } from "../route";
import { CONSENT_TEXT_VERSION } from "../../../consent-version";

// Synthetic data only (ADR: no lead data in fixtures).
const valid = {
  email: "lead@example.com",
  whatsapp: "+55 11 90000-0000",
  consent_email: true,
  consent_whatsapp: true,
  idempotency_key: "11111111-2222-4333-8444-555555555555",
  utm_source: "google"
};
const req = (body: unknown) => new Request("http://localhost/api/leads", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/leads", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("calls capture_lead with the documented params and apikey header", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify("uuid"), { status: 200 }));
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/capture_lead");
    expect(init.headers).toEqual({ "Content-Type": "application/json", apikey: "test-secret" });
    expect(JSON.parse(init.body)).toEqual({
      p_email: "lead@example.com",
      p_whatsapp: "+5511900000000",
      p_consent_text_version: "2026-10-12",
      p_lead_magnet_slug: null,
      p_utm: { utm_source: "google" },
      p_idempotency_key: valid.idempotency_key
    });
  });

  it("returns the same response for an already registered email", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify("same-uuid"), { status: 200 }));
    const first = await POST(req(valid));
    const second = await POST(req({ ...valid, idempotency_key: "99999999-2222-4333-8444-555555555555" }));
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
  });

  it.each([
    ["email", { email: "" }],
    ["whatsapp", { whatsapp: "" }],
    ["consent_email", { consent_email: false }],
    ["consent_whatsapp", { consent_whatsapp: undefined }],
    ["idempotency_key", { idempotency_key: "x" }]
  ])("rejects missing/invalid %s without calling Supabase", async (_name, patch) => {
    const res = await POST(req({ ...valid, ...patch }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  const sentWhatsapp = () => JSON.parse(fetchMock.mock.calls[0][1].body).p_whatsapp;

  it.each(["(11) 90000-0000", "11900000000", "+55 11 90000-0000"])("normalizes WhatsApp %s to +5511900000000", async (input) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify("uuid"), { status: 200 }));
    expect((await POST(req({ ...valid, whatsapp: input }))).status).toBe(200);
    expect(sentWhatsapp()).toBe("+5511900000000");
  });

  it("checks 10/11 digits before the 55 rule (DDD 55): 55 99123-4567 -> +5555991234567", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify("uuid"), { status: 200 }));
    expect((await POST(req({ ...valid, whatsapp: "55 99123-4567" }))).status).toBe(200);
    expect(sentWhatsapp()).toBe("+5555991234567");
  });

  it("sends p_whatsapp matching the DB check (crm_core.sql:13)", async () => {
    const sql = readFileSync(join(__dirname, "../../../../supabase/migrations/20261012030000_crm_core.sql"), "utf8");
    expect(sql.split("\n")[12]).toContain("check (whatsapp ~ '^\\+55[0-9]{10,11}$')");
    const dbRe = /^\+55[0-9]{10,11}$/;
    expect(DB_WHATSAPP_RE.source).toBe("^\\+55\\d{10,11}$");
    for (const input of ["(11) 3000-0000", "11900000000", "551130000000", "+55 (11) 90000-0000"]) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(new Response(JSON.stringify("uuid"), { status: 200 }));
      expect((await POST(req({ ...valid, whatsapp: input }))).status).toBe(200);
      expect(sentWhatsapp()).toMatch(dbRe);
    }
  });

  it.each(["123", "900000000", "+1 212 555 0100 99", "44 11 90000-00000", "abc", "5511900000000000"])("rejects WhatsApp %s with 400 without calling Supabase", async (input) => {
    expect((await POST(req({ ...valid, whatsapp: input }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a generic error when Supabase fails or env is missing", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    expect((await POST(req(valid))).status).toBe(502);
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect((await POST(req(valid))).status).toBe(502);
  });

  it("privacy page shows the same version the code stores", () => {
    expect(CONSENT_TEXT_VERSION).toBe("2026-10-12");
    const page = readFileSync(join(__dirname, "../../../privacidade/page.tsx"), "utf8");
    expect(page).toContain("Versão {CONSENT_TEXT_VERSION}, atualizada em {CONSENT_TEXT_UPDATED_AT}");
  });
  const utmOf = () => JSON.parse(fetchMock.mock.calls[0][1].body).p_utm;
  const okRpc = () => fetchMock.mockResolvedValue(new Response(JSON.stringify("uuid"), { status: 200 }));

  it("rejects invalid JSON body", async () => {
    const res = await POST(new Request("http://localhost/api/leads", { method: "POST", body: "{not json" }));
    expect(res.status).toBe(400);
  });

  it("does not log lead data", async () => {
    okRpc();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await POST(req(valid));
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("lead@example.com");
    logSpy.mockRestore();
  });

  it("discards utm params longer than 100 chars and keeps the lead", async () => {
    okRpc();
    const res = await POST(req({ ...valid, utm_source: "a".repeat(101), utm_medium: "short" }));
    expect(res.status).toBe(200);
    expect(utmOf()).toEqual({ utm_medium: "short" });
  });

  it("keeps utm params with exactly 100 chars", async () => {
    okRpc();
    await POST(req({ ...valid, utm_source: "a".repeat(100) }));
    expect(utmOf()).toEqual({ utm_source: "a".repeat(100) });
  });

  it("treats empty or whitespace-only utm params as absent", async () => {
    okRpc();
    await POST(req({ ...valid, utm_source: "  ", utm_medium: "", utm_campaign: "", utm_content: "" }));
    expect(utmOf()).toEqual({});
  });
});

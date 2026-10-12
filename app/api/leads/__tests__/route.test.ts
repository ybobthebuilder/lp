import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../route";

describe("POST /api/leads", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should reject invalid email", async () => {
    const request = new Request("http://localhost/api/leads", {
      method: "POST",
      body: JSON.stringify({ email: "invalid" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("should not log email in lead capture", async () => {
    const request = new Request("http://localhost/api/leads", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        utm_source: "google",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const logCall = consoleSpy.mock.calls.find(
      (call) => call[0] === "lead_capture"
    );
    expect(logCall).toBeDefined();

    const logData = logCall?.[1] as Record<string, unknown>;
    expect(logData.email).toBeUndefined();
    expect(logData.utm_source).toBe("google");
  });

  it("should truncate utm params longer than 100 chars", async () => {
    const longUTM = "a".repeat(101);
    const request = new Request("http://localhost/api/leads", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        utm_source: longUTM,
        utm_medium: "short",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const logCall = consoleSpy.mock.calls.find(
      (call) => call[0] === "lead_capture"
    );
    const logData = logCall?.[1] as Record<string, unknown>;

    expect(logData.utm_source).toBeUndefined(); // truncated, so discarded
    expect(logData.utm_medium).toBe("short"); // kept
  });

  it("should keep lead even if utm params are discarded", async () => {
    const request = new Request("http://localhost/api/leads", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        utm_source: "a".repeat(101),
        utm_medium: "a".repeat(101),
        utm_campaign: "a".repeat(101),
        utm_content: "a".repeat(101),
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
  it("should reject invalid JSON body", async () => {
    const request = new Request("http://localhost/api/leads", {
      method: "POST",
      body: "{not json",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("should keep utm params with exactly 100 chars", async () => {
    const utm100 = "a".repeat(100);
    const request = new Request("http://localhost/api/leads", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", utm_source: utm100 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const logCall = consoleSpy.mock.calls.find(
      (call) => call[0] === "lead_capture"
    );
    const logData = logCall?.[1] as Record<string, unknown>;
    expect(logData.utm_source).toBe(utm100);
  });

  it("should treat empty utm params as undefined", async () => {
    const request = new Request("http://localhost/api/leads", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        utm_source: "",
        utm_medium: "",
        utm_campaign: "",
        utm_content: "",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const logCall = consoleSpy.mock.calls.find(
      (call) => call[0] === "lead_capture"
    );
    const logData = logCall?.[1] as Record<string, unknown>;
    expect(logData.utm_source).toBeUndefined();
    expect(logData.utm_medium).toBeUndefined();
    expect(logData.utm_campaign).toBeUndefined();
    expect(logData.utm_content).toBeUndefined();
  });
});

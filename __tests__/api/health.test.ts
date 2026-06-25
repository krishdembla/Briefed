import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLimit = vi.fn();

vi.mock("@/lib/db/supabase-service", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ limit: mockLimit })),
    })),
  },
}));

import { GET } from "@/app/api/health/route";

describe("/api/health", () => {
  beforeEach(() => {
    // All required env vars present
    process.env.GROQ_API_KEY = "test";
    process.env.RESEND_API_KEY = "test";
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "test";
    process.env.CRON_SECRET = "test";
    // Supabase healthy by default
    mockLimit.mockResolvedValue({ error: null });
  });

  it("returns 200 and status ok when all checks pass", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.supabase).toBe("ok");
    expect(body.checks.env).toBe("ok");
  });

  it("returns 503 and status degraded when Supabase fails", async () => {
    mockLimit.mockResolvedValueOnce({ error: { message: "connection refused" } });
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.supabase).toBe("connection refused");
  });

  it("returns 503 when a required env var is missing", async () => {
    delete process.env.GROQ_API_KEY;
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.env).toContain("GROQ_API_KEY");
  });

  it("response always includes supabase and env check keys", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.checks).toHaveProperty("supabase");
    expect(body.checks).toHaveProperty("env");
  });
});

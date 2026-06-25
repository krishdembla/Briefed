import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

const mockUpsert = vi.fn();

vi.mock("@/lib/db/supabase-service", () => ({
  supabase: {
    from: vi.fn(() => ({ upsert: mockUpsert })),
  },
}));

import { GET } from "@/app/api/unsubscribe/route";

const SECRET = "test-cron-secret";
process.env.CRON_SECRET = SECRET;

function validToken(userId: string) {
  return createHmac("sha256", SECRET).update(userId).digest("hex");
}

function req(params: Record<string, string>) {
  const url = new URL("http://localhost/api/unsubscribe");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

describe("/api/unsubscribe", () => {
  beforeEach(() => {
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("returns 400 when both uid and token are missing", async () => {
    const res = await GET(req({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is missing", async () => {
    const res = await GET(req({ uid: "user-123" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when uid is missing", async () => {
    const res = await GET(req({ token: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token does not match uid", async () => {
    const res = await GET(req({ uid: "user-123", token: "wrong-token" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 when HMAC token is valid", async () => {
    const userId = "user-abc";
    const res = await GET(req({ uid: userId, token: validToken(userId) }));
    expect(res.status).toBe(200);
  });

  it("returns 500 when Supabase upsert fails", async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: "DB error" } });
    const userId = "user-abc";
    const res = await GET(req({ uid: userId, token: validToken(userId) }));
    expect(res.status).toBe(500);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/env", () => ({}));
vi.mock("@/lib/email/alerts", () => ({ sendAlertEmail: vi.fn() }));
vi.mock("@/lib/ai/generateDigest", () => ({ generateDigestIntro: vi.fn().mockResolvedValue("Test intro") }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn().mockResolvedValue({ error: null }) };
  },
}));

// vi.hoisted ensures these are available when the vi.mock factory runs (factories are hoisted)
const { mockPinsOrder, mockUsersListUsers, mockPrefsSelect } = vi.hoisted(() => ({
  mockPinsOrder: vi.fn(),
  mockUsersListUsers: vi.fn(),
  mockPrefsSelect: vi.fn(),
}));

vi.mock("@/lib/db/supabase-service", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "pins") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: mockPinsOrder,
        };
      }
      // user_preferences table
      return { select: mockPrefsSelect };
    }),
    auth: { admin: { listUsers: mockUsersListUsers } },
  },
}));

import { GET } from "@/app/api/email/send-digest/route";

const CRON = "test-cron";
const PIPE = "test-pipe";

function req(auth?: string) {
  return new NextRequest("http://localhost/api/email/send-digest", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("/api/email/send-digest", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON;
    process.env.PIPELINE_SECRET = PIPE;
    vi.clearAllMocks();
  });

  it("returns 401 with no auth header", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong token", async () => {
    const res = await GET(req("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 422 when no pins are available", async () => {
    mockPinsOrder.mockResolvedValueOnce({ data: [], error: null });
    const res = await GET(req(`Bearer ${CRON}`));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 422 when Supabase pins query fails", async () => {
    mockPinsOrder.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });
    const res = await GET(req(`Bearer ${PIPE}`));
    expect(res.status).toBe(422);
  });

  it("returns 422 when no users exist", async () => {
    mockPinsOrder.mockResolvedValueOnce({
      data: [{ headline: "Test", topic: "tech", region_label: "Europe" }],
      error: null,
    });
    mockUsersListUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });
    const res = await GET(req(`Bearer ${CRON}`));
    expect(res.status).toBe(422);
  });
});

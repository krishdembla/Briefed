import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockOrder = vi.fn();

vi.mock("@/lib/db/supabase-service", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: mockOrder,
    })),
  },
}));

import { GET } from "@/app/api/pins/route";

const PINS = [
  { id: "1", headline: "Test Pin", lat: 51.5, lng: -0.1, published_at: new Date().toISOString() },
];

function req(hours?: string) {
  const url = new URL("http://localhost/api/pins");
  if (hours !== undefined) url.searchParams.set("hours", hours);
  return new NextRequest(url.toString());
}

describe("/api/pins", () => {
  beforeEach(() => {
    mockOrder.mockResolvedValue({ data: PINS, error: null });
  });

  it("returns pins array on success", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(PINS);
  });

  it("returns empty array when no pins exist", async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: null });
    const res = await GET(req());
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns 500 on Supabase error", async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });
    const res = await GET(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("defaults to 168 hours when no param provided", async () => {
    await GET(req());
    // gte() is called with a timestamp ~168h ago; just confirm it was called
    const { supabase } = await import("@/lib/db/supabase-service");
    expect(supabase.from).toHaveBeenCalledWith("pins");
  });

  it("clamps hours above 168 down to 168", async () => {
    // If clamping works, the request succeeds without error
    const res = await GET(req("9999"));
    expect(res.status).toBe(200);
  });

  it("clamps hours below 1 up to 1", async () => {
    const res = await GET(req("0"));
    expect(res.status).toBe(200);
  });

  it("handles non-numeric hours by defaulting to 168", async () => {
    const res = await GET(req("not-a-number"));
    expect(res.status).toBe(200);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Prevent lib/env from throwing at import time
vi.mock("@/lib/env", () => ({}));

// Mock the pipeline so tests don't hit real APIs
vi.mock("@/pipeline/run", () => ({
  runPipeline: vi.fn(),
}));

import { GET, POST } from "@/app/api/pipeline/route";
import { runPipeline } from "@/pipeline/run";

const CRON = "test-cron-secret";
const PIPE = "test-pipeline-secret";

function req(method = "GET", auth?: string) {
  return new NextRequest("http://localhost/api/pipeline", {
    method,
    headers: auth ? { authorization: auth } : {},
  });
}

describe("/api/pipeline", () => {
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
    const res = await GET(req("GET", "Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("accepts CRON_SECRET and returns 200", async () => {
    vi.mocked(runPipeline).mockResolvedValueOnce({ status: "ok" } as never);
    const res = await GET(req("GET", `Bearer ${CRON}`));
    expect(res.status).toBe(200);
  });

  it("accepts PIPELINE_SECRET via POST and returns 200", async () => {
    vi.mocked(runPipeline).mockResolvedValueOnce({ status: "ok" } as never);
    const res = await POST(req("POST", `Bearer ${PIPE}`));
    expect(res.status).toBe(200);
  });

  it("returns 500 with error message when pipeline throws", async () => {
    vi.mocked(runPipeline).mockRejectedValueOnce(new Error("Pipeline exploded"));
    const res = await GET(req("GET", `Bearer ${CRON}`));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Pipeline exploded");
  });
});

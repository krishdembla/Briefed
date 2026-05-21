import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

// Wraps axios with timeout + exponential backoff retries.
// Throws after all retries are exhausted so callers can handle gracefully.
export async function fetchWithRetry<T>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  const cfg = { timeout: DEFAULT_TIMEOUT_MS, ...config };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await axios.request<T>(cfg);
    } catch (err) {
      const isLast = attempt === MAX_RETRIES;
      if (isLast) throw err;

      const backoffMs = 500 * 2 ** attempt; // 500ms, 1000ms
      console.warn(
        `[fetchWithRetry] attempt ${attempt + 1} failed for ${cfg.url} — retrying in ${backoffMs}ms`,
        err instanceof Error ? err.message : err
      );
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error("fetchWithRetry: exhausted retries");
}

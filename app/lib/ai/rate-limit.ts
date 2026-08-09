/**
 * Rate limiting for the one endpoint that spends money.
 *
 * Two implementations behind one seam. The in-memory one is a speed bump: it is
 * per-isolate, so on a serverless platform where each request may land in a fresh
 * instance it is very close to no limit at all. The Redis one is a real limit,
 * shared across every instance, and turns on by itself as soon as the credentials
 * exist.
 *
 * The important part is `askIsMetered` at the bottom: without a real limiter, a
 * paid provider is not served at all. A public children's app that quietly bills
 * its owner for every request anyone on the internet cares to send is not a
 * trade-off worth making silently.
 */
export const WINDOW_MS = 60_000;
export const MAX_PER_WINDOW = 12;

export type RateLimiter = {
  name: "memory" | "redis";
  /** True when this caller has had enough for now. */
  limited(key: string): Promise<boolean>;
};

// ---------------------------------------------------------------------------

const hits = new Map<string, number[]>();

export const memoryLimiter: RateLimiter = {
  name: "memory",
  async limited(key) {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
    recent.push(now);
    hits.set(key, recent);
    // Bounded so a long-lived isolate cannot accumulate keys without limit.
    if (hits.size > 5_000) {
      for (const [existing, times] of hits) {
        if (times.every((at) => now - at >= WINDOW_MS)) hits.delete(existing);
      }
    }
    return recent.length > MAX_PER_WINDOW;
  },
};

/**
 * A fixed window in Redis over the REST API.
 *
 * REST and a raw `fetch` rather than a client library: this runs on both workerd
 * and Vercel's runtime, and an HTTP call works on each without a dependency that
 * has to support them.
 *
 * `INCR` then `EXPIRE … NX` in one pipeline, so the counter and its lifetime are
 * set together. Doing them as two round trips can leave a key with no expiry if
 * the second fails, and that key then blocks its caller forever.
 */
export function redisLimiter(url: string, token: string): RateLimiter {
  return {
    name: "redis",
    async limited(key) {
      const window = Math.floor(Date.now() / WINDOW_MS);
      const redisKey = `ask:${key}:${window}`;
      try {
        const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify([
            ["INCR", redisKey],
            ["EXPIRE", redisKey, Math.ceil(WINDOW_MS / 1000) + 5, "NX"],
          ]),
        });
        if (!response.ok) throw new Error(`redis ${response.status}`);
        const results = (await response.json()) as { result?: number }[];
        const count = Number(results?.[0]?.result ?? 0);
        return count > MAX_PER_WINDOW;
      } catch (error) {
        // Fails *closed*. If the limiter is unreachable there is no way to know
        // whether this caller has had ten requests or ten thousand, and the
        // alternative is an unmetered paid endpoint. A child sees the same friendly
        // "try again" they would see for any hiccup.
        console.error("rate limiter unavailable, refusing the request:", error);
        return true;
      }
    },
  };
}

type Env = Record<string, string | undefined>;

/**
 * Picks the limiter from the environment.
 *
 * Both spellings are accepted: Vercel's KV integration sets `KV_REST_API_*`, and
 * Upstash's own dashboard gives `UPSTASH_REDIS_REST_*`. They are the same service
 * and the same API.
 */
export function selectLimiter(env: Env): RateLimiter {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? redisLimiter(url, token) : memoryLimiter;
}

/**
 * Whether a paid provider may actually be used.
 *
 * A paid provider plus a per-isolate limiter on a public site means unbounded
 * spend, so that combination serves the stub instead. `ASK_ALLOW_UNMETERED=true`
 * overrides it for local development, where the only caller is the developer.
 *
 * Returning a reason rather than a bare boolean so the endpoint can say *why* it
 * is on the stub — the alternative is a deploy that silently answers from canned
 * text and looks like the key never arrived.
 */
export function askIsMetered(
  env: Env,
  limiter: RateLimiter,
): { ok: true } | { ok: false; reason: string } {
  if (limiter.name === "redis") return { ok: true };
  if (env.ASK_ALLOW_UNMETERED === "true") return { ok: true };
  return {
    ok: false,
    reason:
      "No shared rate limiter is configured, so a paid provider would be unmetered on a public URL. " +
      "Set KV_REST_API_URL and KV_REST_API_TOKEN (Vercel KV or Upstash), or set ASK_ALLOW_UNMETERED=true " +
      "if this deployment is not public.",
  };
}

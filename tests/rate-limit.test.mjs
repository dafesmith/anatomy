import assert from "node:assert/strict";
import test from "node:test";

import {
  askIsMetered,
  MAX_PER_WINDOW,
  memoryLimiter,
  redisLimiter,
  selectLimiter,
} from "../app/lib/ai/rate-limit.ts";

test("the memory limiter lets a normal child through and stops a loop", async () => {
  const key = `normal-${Math.random()}`;
  for (let i = 0; i < MAX_PER_WINDOW; i += 1) {
    assert.equal(await memoryLimiter.limited(key), false, `blocked on request ${i + 1}`);
  }
  assert.equal(await memoryLimiter.limited(key), true, "the loop was not stopped");
});

test("callers are counted separately", async () => {
  const a = `a-${Math.random()}`;
  const b = `b-${Math.random()}`;
  for (let i = 0; i < MAX_PER_WINDOW + 1; i += 1) await memoryLimiter.limited(a);
  assert.equal(await memoryLimiter.limited(b), false, "one caller's limit hit another");
});

test("Redis is used whenever its credentials exist, under either spelling", () => {
  assert.equal(selectLimiter({}).name, "memory");
  assert.equal(
    selectLimiter({ KV_REST_API_URL: "https://x", KV_REST_API_TOKEN: "t" }).name,
    "redis",
    "Vercel KV's own variable names were not recognised",
  );
  assert.equal(
    selectLimiter({ UPSTASH_REDIS_REST_URL: "https://x", UPSTASH_REDIS_REST_TOKEN: "t" }).name,
    "redis",
    "Upstash's own variable names were not recognised",
  );
  // Half a configuration is not a configuration.
  assert.equal(selectLimiter({ KV_REST_API_URL: "https://x" }).name, "memory");
  assert.equal(selectLimiter({ KV_REST_API_TOKEN: "t" }).name, "memory");
});

// ---------------------------------------------------------------------------
// The metering gate. This is what stands between a public URL and an open wallet.
// ---------------------------------------------------------------------------

test("a paid provider is refused when only the per-isolate limiter is available", () => {
  const verdict = askIsMetered({}, memoryLimiter);
  assert.equal(verdict.ok, false);
  // The reason has to name the fix, or a deploy just mysteriously answers from
  // canned text and looks like the key never arrived.
  assert.match(verdict.reason, /KV_REST_API_URL/);
  assert.match(verdict.reason, /ASK_ALLOW_UNMETERED/);
});

test("a shared limiter is enough on its own", () => {
  const redis = redisLimiter("https://example.invalid", "token");
  assert.deepEqual(askIsMetered({}, redis), { ok: true });
});

test("the override works, and only for the exact string", () => {
  assert.deepEqual(askIsMetered({ ASK_ALLOW_UNMETERED: "true" }, memoryLimiter), { ok: true });
  // Anything vaguely truthy must not open the endpoint by accident.
  for (const value of ["1", "yes", "TRUE", "", "false"]) {
    assert.equal(
      askIsMetered({ ASK_ALLOW_UNMETERED: value }, memoryLimiter).ok,
      false,
      `"${value}" was treated as an override`,
    );
  }
});

test("an unreachable Redis fails closed rather than open", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  try {
    const limiter = redisLimiter("https://example.invalid", "token");
    // With no way to know whether this caller has had ten requests or ten
    // thousand, the only safe answer is no.
    assert.equal(await limiter.limited("someone"), true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a Redis error status also fails closed", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => [] });
  try {
    const limiter = redisLimiter("https://example.invalid", "token");
    assert.equal(await limiter.limited("someone"), true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("Redis counts a fixed window and sets an expiry in the same round trip", async () => {
  const realFetch = globalThis.fetch;
  const sent = [];
  let count = 0;
  globalThis.fetch = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) });
    count += 1;
    return { ok: true, status: 200, json: async () => [{ result: count }, { result: 1 }] };
  };
  try {
    const limiter = redisLimiter("https://example.invalid/", "token");
    for (let i = 0; i < MAX_PER_WINDOW; i += 1) {
      assert.equal(await limiter.limited("kid"), false, `blocked on ${i + 1}`);
    }
    assert.equal(await limiter.limited("kid"), true);

    const [first] = sent;
    assert.match(first.url, /\/pipeline$/, "the trailing slash was not handled");
    assert.equal(first.body.length, 2, "INCR and EXPIRE should travel together");
    assert.equal(first.body[0][0], "INCR");
    assert.equal(first.body[1][0], "EXPIRE");
    // NX, so a later request in the same window cannot push the expiry out and
    // keep a counter alive indefinitely.
    assert.equal(first.body[1][3], "NX");
  } finally {
    globalThis.fetch = realFetch;
  }
});

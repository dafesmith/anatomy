import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { selectProvider, stubProvider } from "../app/lib/ai/providers.ts";
import { MAX_ANSWER_WORDS, suggestedQuestions } from "../app/lib/ai/prompt.ts";

const context = { organId: "heart", level: "simple" };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Captures the outgoing request and replies with whatever the model "said". */
function stubFetch(content, { ok = true, status = 200, body } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, sent: JSON.parse(init.body) });
    if (!ok) return { ok: false, status, text: async () => body ?? "upstream said no" };
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content } }] }),
    };
  };
  return calls;
}

const ask = (env, over = {}) =>
  selectProvider(env).ask({ context, history: [], question: "What does the heart do?", ...over });

// ---------------------------------------------------------------------------
// The length-cap parameter. Sending the wrong spelling does not degrade the
// answer — OpenAI rejects the request outright, so every single question fails.
// This is the regression test for exactly that.
// ---------------------------------------------------------------------------

test("openai is sent max_completion_tokens, never max_tokens", async () => {
  const calls = stubFetch('{"answer":"It pumps blood.","needsGrownUp":false}');
  await ask({ ASK_PROVIDER: "openai", OPENAI_API_KEY: "k" });

  const { sent } = calls[0];
  assert.equal(typeof sent.max_completion_tokens, "number", "max_completion_tokens missing");
  assert.ok(!("max_tokens" in sent), "max_tokens would be rejected with a 400 by the gpt-5 series");
});

test("the OpenAI-compatible providers keep the original max_tokens spelling", async () => {
  for (const [provider, keyName] of [
    ["zai", "ZAI_API_KEY"],
    ["ollama", "OLLAMA_API_KEY"],
  ]) {
    const calls = stubFetch('{"answer":"ok","needsGrownUp":false}');
    await ask({ ASK_PROVIDER: provider, [keyName]: "k" });
    const { sent } = calls[0];
    assert.equal(typeof sent.max_tokens, "number", `${provider}: max_tokens missing`);
    assert.ok(!("max_completion_tokens" in sent), `${provider}: wrong spelling sent`);
  }
});

test("every provider asks for a model, and none defaults to a bare family name", async () => {
  // `gpt-5.6` was once the default and does not exist — only `-luna`, `-sol` and
  // `-terra` do — so it 404'd on every request. A family name with no variant is
  // the shape of that mistake.
  for (const [provider, keyName] of [
    ["openai", "OPENAI_API_KEY"],
    ["zai", "ZAI_API_KEY"],
    ["ollama", "OLLAMA_API_KEY"],
  ]) {
    const calls = stubFetch('{"answer":"ok","needsGrownUp":false}');
    await ask({ ASK_PROVIDER: provider, [keyName]: "k" });
    const { model } = calls[0].sent;
    assert.ok(model && model.length > 3, `${provider}: no model requested`);
    assert.notEqual(model, "gpt-5.6", "the non-existent default is back");
  }
});

test("ASK_MODEL overrides the default without a code change", async () => {
  const calls = stubFetch('{"answer":"ok","needsGrownUp":false}');
  await ask({ ASK_PROVIDER: "openai", OPENAI_API_KEY: "k", ASK_MODEL: "gpt-5.4-nano" });
  assert.equal(calls[0].sent.model, "gpt-5.4-nano");
});

// ---------------------------------------------------------------------------
// Request shape
// ---------------------------------------------------------------------------

test("the system prompt leads, then history in order, then the new question", async () => {
  const calls = stubFetch('{"answer":"ok","needsGrownUp":false}');
  await ask(
    { ASK_PROVIDER: "openai", OPENAI_API_KEY: "k" },
    {
      history: [
        { role: "user", content: "first" },
        { role: "assistant", content: "second" },
      ],
      question: "third",
    },
  );

  const { messages } = calls[0].sent;
  assert.equal(messages[0].role, "system");
  assert.match(messages[0].content, /NEVER give medical advice/);
  assert.deepEqual(
    messages.slice(1).map((m) => [m.role, m.content]),
    [
      ["user", "first"],
      ["assistant", "second"],
      ["user", "third"],
    ],
  );
});

test("an image rides along only when one is given", async () => {
  const withImage = stubFetch('{"answer":"That is the aorta.","needsGrownUp":false}');
  await ask({ ASK_PROVIDER: "openai", OPENAI_API_KEY: "k" }, { image: "data:image/jpeg;base64,AAAA" });
  const sent = withImage[0].sent.messages.at(-1).content;
  assert.ok(Array.isArray(sent), "a captured view should be multimodal content");
  assert.deepEqual(
    sent.map((part) => part.type),
    ["text", "image_url"],
  );

  const without = stubFetch('{"answer":"ok","needsGrownUp":false}');
  await ask({ ASK_PROVIDER: "openai", OPENAI_API_KEY: "k" });
  assert.equal(typeof without[0].sent.messages.at(-1).content, "string");
});

// ---------------------------------------------------------------------------
// Reading the reply. A model that ignores the reply shape may be ignoring the
// safety rules too, so malformed output is escalated rather than passed through.
// ---------------------------------------------------------------------------

test("JSON wrapped in a code fence is still understood", async () => {
  stubFetch('```json\n{"answer":"It pumps blood.","needsGrownUp":false}\n```');
  const result = await ask({ ASK_PROVIDER: "openai", OPENAI_API_KEY: "k" });
  assert.equal(result.answer, "It pumps blood.");
  assert.equal(result.needsGrownUp, false);
});

test("prose instead of JSON is surfaced but flagged for a grown-up", async () => {
  stubFetch("The heart pumps blood around your body.");
  const result = await ask({ ASK_PROVIDER: "openai", OPENAI_API_KEY: "k" });
  assert.equal(result.answer, "The heart pumps blood around your body.");
  assert.equal(result.needsGrownUp, true, "ignoring the reply shape should escalate");
});

test("an empty reply becomes a friendly retry, not a blank bubble", async () => {
  stubFetch("");
  const result = await ask({ ASK_PROVIDER: "openai", OPENAI_API_KEY: "k" });
  assert.ok(result.answer.length > 10);
  assert.equal(result.needsGrownUp, false, "an empty reply is a glitch, not a safety event");
});

test("needsGrownUp is only ever true when the model actually said so", async () => {
  for (const raw of ['{"answer":"a","needsGrownUp":"yes"}', '{"answer":"a","needsGrownUp":1}']) {
    stubFetch(raw);
    const result = await ask({ ASK_PROVIDER: "openai", OPENAI_API_KEY: "k" });
    assert.equal(result.needsGrownUp, false, `truthy-but-not-true leaked: ${raw}`);
  }
});

test("a runaway answer is trimmed at a sentence end, not mid-word", async () => {
  const long = `${"The heart pumps blood. ".repeat(40)}`;
  stubFetch(JSON.stringify({ answer: long, needsGrownUp: false }));
  const result = await ask({ ASK_PROVIDER: "openai", OPENAI_API_KEY: "k" });
  const words = result.answer.split(/\s+/).length;
  assert.ok(words <= MAX_ANSWER_WORDS * 1.5, `still ${words} words`);
  assert.match(result.answer, /[.!?…]$/, "should end on a stop");
});

// ---------------------------------------------------------------------------
// Failure and configuration
// ---------------------------------------------------------------------------

test("an upstream failure throws without leaking the key", async () => {
  // A 401 from OpenAI quotes back the key it rejected, and this message is logged.
  // The fixture keeps the `sk-` prefix because that is what the redaction matches
  // on, but is otherwise deliberately low-entropy and self-describing so secret
  // scanners (and GitHub push protection) do not mistake it for the real thing.
  const key = "sk-proj-NOT-A-REAL-KEY-000000";
  const bodies = [
    // Echoed verbatim.
    `{"error":{"message":"Incorrect API key provided: ${key}"}}`,
    // Partially masked — still enough to correlate against a leaked key.
    '{"error":{"message":"Incorrect API key provided: sk-proj-SEC***123"}}',
    // Past the 200-char truncation point, so trimming alone would not save it.
    `{"error":{"message":"${"padding ".repeat(40)}${key}"}}`,
  ];

  for (const body of bodies) {
    stubFetch(null, { ok: false, status: 401, body });
    await assert.rejects(
      () => ask({ ASK_PROVIDER: "openai", OPENAI_API_KEY: key }),
      (error) => {
        assert.match(error.message, /openai: 401/, "the route needs the status to degrade on");
        assert.ok(!error.message.includes(key), `key survived: ${body.slice(0, 60)}`);
        assert.ok(!/sk-proj-[A-Za-z0-9]/.test(error.message), `key-shaped text survived: ${error.message}`);
        return true;
      },
    );
  }
});

test("no key means the stub, so a child never meets an error page", () => {
  assert.equal(selectProvider({}).name, "stub");
  assert.equal(selectProvider({ ASK_PROVIDER: "nonsense" }).name, "stub");
  assert.equal(selectProvider({ ASK_PROVIDER: "openai" }).ready, false, "no key is not ready");
  assert.equal(selectProvider({ ASK_PROVIDER: "openai", OPENAI_API_KEY: "k" }).ready, true);
});

test("the stub is unmistakably canned, and still honours the grown-up rule", async () => {
  const plain = await stubProvider.ask({ context, history: [], question: "What does the heart do?" });
  assert.match(plain.answer, /stub/i, "a canned answer must never pass for a real one");

  const worry = await stubProvider.ask({ context, history: [], question: "My chest hurts, am i ok?" });
  assert.equal(worry.needsGrownUp, true);
  assert.ok(!/stub/i.test(worry.answer), "the grown-up hand-off should read as a real reply");
});

// ---------------------------------------------------------------------------

test("the suggested buttons agree with their organ in number", async () => {
  // "What does the lungs do?" shipped for months. Plural names take a plural verb;
  // "Pancreas" ends in an s and does not.
  for (const [organId, expected] of [
    ["lungs", /^What do the lungs do\?$/],
    ["kidneys", /^Why are the kidneys that shape\?$/],
    ["pancreas", /^What does the pancreas do\?$/],
    ["heart", /^What does the heart do\?$/],
  ]) {
    const asked = suggestedQuestions({ organId, level: "simple" });
    assert.ok(
      asked.some((question) => expected.test(question)),
      `${organId}: none of ${JSON.stringify(asked)} matched ${expected}`,
    );
  }
});

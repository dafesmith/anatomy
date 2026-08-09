// `.ts` extensions here for the same reason as in `prompt.ts`: the test suite
// imports this module directly and Node's TypeScript loader cannot resolve an
// extensionless relative specifier at runtime.
import { organById } from "../anatomy-data.ts";
import { organReadings } from "../kid-readings.ts";
import { MAX_ANSWER_WORDS, systemPrompt, type AskContext, type Turn } from "./prompt.ts";

export type AskResult = { answer: string; needsGrownUp: boolean };

/**
 * One seam, so the choice of model is a config change rather than a rewrite.
 *
 * Everything that decides whether this is safe for a child — the prompt, the
 * topic fence, the never-diagnose rules, the grounding facts — lives in
 * `prompt.ts` and is identical for every provider below. Swapping models changes
 * the quality of the answer, never the rules it answers under.
 */
export type AskProvider = {
  name: string;
  /** False when the provider has no credentials, so the route can say why. */
  ready: boolean;
  ask(input: { context: AskContext; history: Turn[]; question: string; image?: string }): Promise<AskResult>;
};

/** Models are asked for JSON but sometimes wrap it in prose or a code fence. */
function parseResult(raw: string): AskResult {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<AskResult>;
      if (typeof parsed.answer === "string" && parsed.answer.trim()) {
        return { answer: parsed.answer.trim(), needsGrownUp: parsed.needsGrownUp === true };
      }
    } catch {
      // Fall through to the plain-text path below.
    }
  }
  // No JSON at all. Rather than fail, treat the text as the answer but flag it —
  // a model ignoring the reply shape is a model that may be ignoring other
  // instructions too, so a grown-up should see this one.
  return cleaned
    ? { answer: cleaned, needsGrownUp: true }
    : { answer: "I didn't quite catch that. Try asking again?", needsGrownUp: false };
}

/**
 * Strips credentials out of an upstream error body before it is logged.
 *
 * Two passes, because neither alone is enough: the exact key catches a provider
 * that echoes it verbatim, and the generic pattern catches the partially-masked
 * forms (`sk-proj-abc***xyz`) and any other bearer token that happens to be in
 * the body. Truncation happens after redaction, so a key cannot survive by
 * sitting past the cut.
 */
function redact(body: string, apiKey?: string): string {
  let safe = body;
  if (apiKey) safe = safe.split(apiKey).join("[redacted]");
  safe = safe.replace(/\b(sk|gsk|xai|pk)-[A-Za-z0-9_*-]{6,}/gi, "[redacted]");
  return safe.slice(0, 200);
}

/** Trims a runaway answer at a sentence boundary rather than mid-word. */
function capLength(result: AskResult): AskResult {
  const words = result.answer.split(/\s+/);
  if (words.length <= MAX_ANSWER_WORDS * 1.5) return result;
  const trimmed = words.slice(0, MAX_ANSWER_WORDS).join(" ");
  const lastStop = Math.max(trimmed.lastIndexOf("."), trimmed.lastIndexOf("!"), trimmed.lastIndexOf("?"));
  return { ...result, answer: lastStop > 40 ? trimmed.slice(0, lastStop + 1) : `${trimmed}…` };
}

// ---------------------------------------------------------------------------
// Stub — the default until a key is configured.
// ---------------------------------------------------------------------------

/**
 * Answers from the atlas without a model, so the whole path — gating, rate limit,
 * conversation state, read-aloud — is testable before any provider exists and
 * with no spend. It is deliberately obvious that it is canned; it must never be
 * mistaken for a real answer.
 */
export const stubProvider: AskProvider = {
  name: "stub",
  ready: true,
  async ask({ context, question }) {
    const organ = organById[context.organId];
    const name = organ.name.toLowerCase();
    const kid = context.level === "original" ? organ.description : organReadings[context.organId][context.level];
    const asked = question.toLowerCase();

    // Mirrors the real rules so the gating and the grown-up card can be tested.
    if (/\b(hurts?|pain|sick|ill|dying|die|cancer|blood test|doctor|my tummy|am i)\b/.test(asked)) {
      return {
        answer: `That's a really good one to ask a grown-up about. I can tell you how the ${name} works, though — want to hear?`,
        needsGrownUp: true,
      };
    }
    if (context.unlabelled) {
      return {
        answer: `(Stub) You tapped a part of the ${name} with no label. A real model would look at the ringed spot in the picture and tell you what it is.`,
        needsGrownUp: false,
      };
    }
    const hotspot = organ.hotspots.find((item) => item.id === context.hotspotId);
    return {
      answer: hotspot
        ? `(Stub) You asked about the ${hotspot.label}: ${hotspot.detail}. ${kid}`
        : `(Stub) ${kid}`,
      needsGrownUp: false,
    };
  },
};

// ---------------------------------------------------------------------------
// OpenAI-compatible chat completions. Covers Z.ai (GLM), Ollama Cloud (Kimi),
// and anything else exposing the same shape — the only differences are the base
// URL, the model id, and the key.
// ---------------------------------------------------------------------------

type ChatConfig = {
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  /**
   * Which field caps the reply length.
   *
   * `max_tokens` is the original chat-completions spelling and still what the
   * OpenAI-compatible providers accept. OpenAI's own gpt-5 series *rejects* it
   * outright — `400 Unsupported parameter` — and requires
   * `max_completion_tokens`. Sending the wrong one fails every single request,
   * so this is set explicitly per provider rather than guessed from the model id,
   * which would quietly break again the next time a family is renamed.
   */
  tokenParam?: "max_tokens" | "max_completion_tokens";
};

function chatProvider({ name, baseUrl, model, apiKey, tokenParam = "max_tokens" }: ChatConfig): AskProvider {
  return {
    name,
    ready: !!apiKey,
    async ask({ context, history, question, image }) {
      if (!apiKey) throw new Error(`${name}: no API key configured`);

      // Only the last turns are sent. Enough to follow "but why?" a few times,
      // bounded so neither the cost nor the topic drift grows without limit.
      const messages: Record<string, unknown>[] = [
        { role: "system", content: systemPrompt(context) },
        ...history.map((turn) => ({ role: turn.role, content: turn.content })),
      ];

      messages.push(
        image
          ? {
              role: "user",
              content: [
                { type: "text", text: question },
                { type: "image_url", image_url: { url: image } },
              ],
            }
          : { role: "user", content: question },
      );

      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, [tokenParam]: 400, stream: false }),
      });

      if (!response.ok) {
        // The upstream body is echoed back so a misconfiguration is diagnosable,
        // but it is scrubbed first: a 401 from OpenAI quotes the key it rejected,
        // and this string ends up in `console.error` — which on a hosted platform
        // means the log retention of whoever can open the dashboard.
        throw new Error(`${name}: ${response.status} ${redact(await response.text(), apiKey)}`);
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return capLength(parseResult(payload.choices?.[0]?.message?.content ?? ""));
    },
  };
}

// ---------------------------------------------------------------------------

type Env = Record<string, string | undefined>;

/**
 * Picks a provider from the environment, defaulting to the stub. Deliberately
 * fails soft: a missing key gives a working app with canned answers rather than
 * a broken route, because a child shouldn't meet an error page.
 */
export function selectProvider(env: Env): AskProvider {
  switch (env.ASK_PROVIDER) {
    case "zai":
      return chatProvider({
        name: "zai",
        baseUrl: env.ZAI_BASE_URL ?? "https://api.z.ai/api/paas/v4",
        model: env.ASK_MODEL ?? "glm-5.2",
        apiKey: env.ZAI_API_KEY,
      });
    case "ollama":
      return chatProvider({
        name: "ollama",
        baseUrl: env.OLLAMA_BASE_URL ?? "https://ollama.com/v1",
        // Kimi K3 is multimodal, so this is the one that can read a capture.
        model: env.ASK_MODEL ?? "kimi-k3:cloud",
        apiKey: env.OLLAMA_API_KEY,
      });
    case "openai":
      return chatProvider({
        name: "openai",
        baseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        // A mini tier on purpose. The questions are short, the facts travel with
        // every one of them, and the answer is capped at 60 words — none of which
        // needs a frontier model. It is also multimodal, which the unlabelled-tap
        // capture requires. `ASK_MODEL` overrides it without a code change.
        model: env.ASK_MODEL ?? "gpt-5.4-mini",
        apiKey: env.OPENAI_API_KEY,
        tokenParam: "max_completion_tokens",
      });
    default:
      return stubProvider;
  }
}

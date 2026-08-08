import { organById, type OrganId } from "../../lib/anatomy-data";
import { MAX_HISTORY_TURNS, type AskContext, type Turn } from "../../lib/ai/prompt";
import { selectProvider } from "../../lib/ai/providers";

const MAX_QUESTION_CHARS = 300;
/** A 512px JPEG capture lands around 30KB; this leaves headroom without
 *  letting a caller post arbitrary payloads to burn tokens. */
const MAX_IMAGE_CHARS = 200_000;
const LEVELS = ["simple", "standard", "original"] as const;

/**
 * Requests per window, per caller. Deliberately tight: this endpoint spends money
 * and the site is public.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

/**
 * ⚠️ In-memory, so it is per-isolate and resets on redeploy or cold start. That
 * makes it a speed bump against a casual loop, NOT protection against real abuse:
 * a distributed caller, or simply enough traffic to spin up several isolates,
 * walks straight past it.
 *
 * Real enforcement needs shared state — a KV or Durable Object binding, neither of
 * which exists in `.openai/hosting.json` yet — or a rate-limit rule in front of
 * the app. Until one of those is in place, treat spend as unbounded and keep the
 * provider on the stub in production.
 */
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  // Bounded so a long-lived isolate can't accumulate keys without limit.
  if (hits.size > 5_000) {
    for (const [existing, times] of hits) {
      if (times.every((at) => now - at >= WINDOW_MS)) hits.delete(existing);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

function callerKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Which provider is configured, so the panel can warn *before* a child asks
 * rather than after the first answer arrives. Returns no secrets — just a name
 * and whether it has credentials.
 */
export async function GET() {
  const provider = selectProvider(process.env as Record<string, string | undefined>);
  return Response.json({ provider: provider.name, ready: provider.ready });
}

type Body = {
  organId?: string;
  hotspotId?: string;
  level?: string;
  unlabelled?: boolean;
  tools?: unknown;
  question?: string;
  history?: unknown;
  image?: string;
};

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (rateLimited(callerKey(request))) {
    return Response.json(
      { error: "Slow down a moment — try again shortly." },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Body must be JSON.");
  }

  // Nothing from the client is trusted. Every field is checked against the atlas
  // rather than passed through, so a caller can't steer the prompt by inventing
  // an organ or smuggling text into a field the prompt interpolates.
  const organId = body.organId as OrganId | undefined;
  if (!organId || !(organId in organById)) return bad("Unknown organ.");
  const organ = organById[organId];

  const level = LEVELS.includes(body.level as (typeof LEVELS)[number])
    ? (body.level as AskContext["level"])
    : "original";

  let hotspotId: string | undefined;
  if (body.hotspotId) {
    if (!organ.hotspots.some((item) => item.id === body.hotspotId)) {
      return bad("That label isn't part of this organ.");
    }
    hotspotId = body.hotspotId;
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return bad("Ask a question.");
  if (question.length > MAX_QUESTION_CHARS) return bad("That question is too long.");

  const history: Turn[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (turn): turn is Turn =>
            !!turn &&
            typeof turn === "object" &&
            ((turn as Turn).role === "user" || (turn as Turn).role === "assistant") &&
            typeof (turn as Turn).content === "string",
        )
        .slice(-MAX_HISTORY_TURNS)
        .map((turn) => ({ role: turn.role, content: turn.content.slice(0, MAX_QUESTION_CHARS * 2) }))
    : [];

  // An image is only meaningful for the one case that needs it. Accepting one
  // otherwise would let a caller attach pictures to every request and multiply
  // the token cost of each.
  let image: string | undefined;
  if (body.image) {
    if (!body.unlabelled) return bad("A picture is only used for an unlabelled spot.");
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(body.image)) return bad("Unsupported image.");
    if (body.image.length > MAX_IMAGE_CHARS) return bad("That picture is too large.");
    image = body.image;
  }

  const tools = Array.isArray(body.tools)
    ? body.tools.filter((tool): tool is string => typeof tool === "string").slice(0, 6)
    : undefined;

  const context: AskContext = {
    organId,
    hotspotId,
    level,
    unlabelled: body.unlabelled === true,
    tools,
  };

  const provider = selectProvider(process.env as Record<string, string | undefined>);

  try {
    const result = await provider.ask({ context, history, question, image });
    return Response.json({ ...result, provider: provider.name });
  } catch (error) {
    // The child sees a friendly line; the detail goes to the logs, not the client.
    console.error("ask route failed", error);
    return Response.json(
      {
        answer: "I couldn't think of an answer just then. Try asking again?",
        needsGrownUp: false,
        provider: provider.name,
        degraded: true,
      },
      { status: 200 },
    );
  }
}

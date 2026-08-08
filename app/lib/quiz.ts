import type { Organ } from "./anatomy-data";

export type QuizQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
  /** An extra fact about this organ, shown after answering. Gives a parent
   *  something to say next rather than ending the exchange at right/wrong. */
  note: string;
};

/**
 * Four questions per organ, built from fields the atlas already carries. Wrong
 * answers are the *same field* from other organs, which makes every distractor
 * plausible and — because no two organs share a value — never accidentally right.
 */
const TEMPLATES: {
  ask: (organ: Organ) => string;
  answer: (organ: Organ) => string;
  note: (organ: Organ) => string;
}[] = [
  {
    ask: (o) => `What does the ${o.name.toLowerCase()} do?`,
    answer: (o) => o.function,
    note: (o) => o.funFact,
  },
  {
    ask: (o) => `Where in your body is the ${o.name.toLowerCase()}?`,
    answer: (o) => o.location,
    note: (o) => o.dailyFact,
  },
  {
    ask: (o) => `How big is the ${o.name.toLowerCase()}?`,
    answer: (o) => o.size,
    note: (o) => `It weighs about ${o.weight}.`,
  },
  {
    ask: (o) => `Which tissue would you find in the ${o.name.toLowerCase()}?`,
    answer: (o) => o.tissue,
    note: (o) => o.medical,
  },
];

/** Deterministic 32-bit hash, so a given organ always gets the same question order. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded Fisher-Yates. Keeps the quiz stable and testable without `Math.random`. */
function shuffle<T>(items: T[], seed: string): T[] {
  const out = [...items];
  let state = hash(seed) || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildQuiz(organ: Organ, allOrgans: Organ[]): QuizQuestion[] {
  const others = allOrgans.filter((item) => item.id !== organ.id);
  return TEMPLATES.map((template, index) => {
    const correct = template.answer(organ);
    const distractors = shuffle(
      others.map(template.answer).filter((value) => value !== correct),
      `${organ.id}-${index}-pool`,
    ).slice(0, 3);
    const options = shuffle([correct, ...distractors], `${organ.id}-${index}`);
    return {
      prompt: template.ask(organ),
      options,
      correctIndex: options.indexOf(correct),
      note: template.note(organ),
    };
  });
}

import { pluralOrganIds, type Organ } from "./anatomy-data.ts";
import { hotspotReading, organDescription, type ReadingLevel } from "./kid-readings.ts";

/**
 * A lesson is a short guided sequence rather than a page of text.
 *
 * Deliberately built from the atlas by plain code, with no model involved. A
 * lesson has to work with the wifi off, cost nothing to open twice, and still be
 * there when a provider is down or a grown-up has left the Ask panel switched
 * off — none of which is true of generated content. The atlas already holds
 * hand-written wording at two child reading levels, so there is nothing here a
 * model would add except cost and a safety surface.
 */
export type LessonStepKind = "place" | "job" | "part" | "size" | "close" | "remember";

export type LessonStep = {
  /** Stable across renders and reading levels, so read-aloud can key off it. */
  id: string;
  kind: LessonStepKind;
  heading: string;
  body: string;
  /** Which illustration belongs with this beat. */
  asset: "organ" | "microscopic" | "compare" | "location";
  /**
   * Whether this beat shows the live 3D model or the flat illustration.
   *
   * Not every beat can be 3D, because the model is the organ on its own: it has no
   * body to sit inside, nothing beside it to be bigger or smaller than, and no
   * tissue detail. So `place`, `size` and `close` keep their illustrations, which
   * were drawn to show exactly those three things, and the rest — the whole organ
   * and each of its labelled parts — turn and can be dragged.
   */
  stage: "model" | "art";
  /**
   * Set on `part` beats. The viewer can use it to bring the matching dot
   * forward, so the lesson and the 3D model stay pointing at the same thing.
   */
  hotspotId?: string;
  /**
   * A short label for the illustration.
   *
   * Some atlas fields are captions rather than prose — `comparison` is literally
   * "Lungs vs. heart" — and reading one aloud as a sentence is what produced
   * "They weigh about About 1 kg for the pair. Lungs vs. heart." Those belong
   * under the picture they describe, not in the body text.
   */
  caption?: string;
};

function agree(organ: Organ) {
  const plural = pluralOrganIds.has(organ.id);
  return {
    plural,
    is: plural ? "are" : "is",
    does: plural ? "do" : "does",
    /** Subject: "it pumps" / "they pump". */
    it: plural ? "they" : "it",
    It: plural ? "They" : "It",
    /** Object: "you will find it" / "you will find them". */
    them: plural ? "them" : "it",
    /** Third-person verb ending: "it weighs" but "they weigh". */
    s: plural ? "" : "s",
  };
}

/**
 * Drops the third-person singular ending off the leading verb of an atlas phrase.
 *
 * `dailyFact` is written as a bare predicate agreeing with a singular subject —
 * "beats about 100,000 times", "moves around 11,000 L of air" — so attaching it
 * to a plural organ yields "they moves". Only the two plural organs need this,
 * and both of their verbs are regular, but the -es cases are handled so a future
 * entry ("flushes", "washes") does not silently produce "they flushe".
 */
function deconjugate(phrase: string, plural: boolean) {
  if (!plural) return phrase;
  const [first, ...rest] = phrase.split(" ");
  const stem = /(?:s|sh|ch|x|z)es$/.test(first)
    ? first.slice(0, -2)
    : /[^s]s$/.test(first)
      ? first.slice(0, -1)
      : first;
  return [stem, ...rest].join(" ");
}

/** Sentence-cases an atlas fragment so it can open a sentence of its own. */
function sentence(text: string) {
  const trimmed = text.trim();
  const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

/** Lower-cases an atlas fragment so it can be dropped mid-sentence. */
function clause(text: string) {
  const trimmed = text.trim().replace(/[.]$/, "");
  // Only the first word, and only if it is not a proper noun or an acronym —
  // "Behind the sternum" should soften, "L of air" and "Vitamin D" should not.
  return /^[A-Z][a-z]/.test(trimmed) ? trimmed.charAt(0).toLowerCase() + trimmed.slice(1) : trimmed;
}

/**
 * Builds the beats for one organ at one reading level.
 *
 * The order is the order a person actually asks in: where is it, what does it
 * do, what are its parts, how big is it, what is it made of, and one thing worth
 * remembering. Every beat carries its own picture so a child who cannot yet read
 * fluently still has something to look at while a parent reads.
 */
export function buildLesson(organ: Organ, level: ReadingLevel): LessonStep[] {
  const name = organ.name.toLowerCase();
  const { is, does, it, It, them, s, plural } = agree(organ);
  const kid = level !== "original";

  const steps: LessonStep[] = [
    {
      id: "place",
      kind: "place",
      heading: `Where ${is} the ${name}?`,
      // `location` is a positional fragment ("Behind the sternum, slightly left"),
      // so it is framed into a sentence rather than printed as one.
      body: `You will find ${them} ${clause(organ.location)}.`,
      asset: "location",
      stage: "art",
      caption: `The ${name} in place`,
    },
    {
      id: "job",
      kind: "job",
      heading: `What ${does} the ${name} do?`,
      // The child wording is already whole sentences pitched at the level, and it
      // is written about what the organ *does* — so it belongs here rather than on
      // the opening beat. `function` is a verb-first database fragment
      // ("Exchanges oxygen for carbon dioxide") and only reads well at `original`.
      body: kid
        ? `${organDescription(organ.id, organ.description, level)} Every day ${it} ${deconjugate(clause(organ.dailyFact), plural)}.`
        : `${sentence(organ.function)} ${sentence(organ.dailyFact)}`,
      asset: "organ",
      stage: "model",
    },
  ];

  // One beat per labelled part, using the hand-written child line where it
  // exists and the anatomical detail where it does not. Both go through
  // `sentence()`: the child lines were written as inline callout labels and carry
  // no terminal punctuation ("The right one, made of three pieces"), which is
  // fine floating beside a dot and wrong when it is a paragraph being read aloud.
  for (const hotspot of organ.hotspots) {
    steps.push({
      id: `part-${hotspot.id}`,
      kind: "part",
      heading: hotspot.label,
      body: sentence(hotspotReading(organ.id, hotspot.id, level) ?? hotspot.detail),
      asset: "organ",
      stage: "model",
      hotspotId: hotspot.id,
    });
  }

  steps.push(
    {
      id: "size",
      kind: "size",
      heading: `How big ${is} the ${name}?`,
      // `weight` sometimes already carries its own "About", which is what produced
      // "weigh about About 1 kg for the pair".
      body: `${sentence(organ.size)} ${It} weigh${s} ${clause(organ.weight.replace(/^about\s+/i, ""))}.`,
      asset: "compare",
      stage: "art",
      caption: organ.comparison,
    },
    {
      id: "close",
      kind: "close",
      heading: `What ${is} the ${name} made of?`,
      // "That is" always refers to the picture, so it stays singular even where
      // the organ itself is plural.
      body: kid
        ? `${sentence(organ.tissue)} That is what ${it} look${s} like very, very close up.`
        : `${sentence(organ.tissue)} ${sentence(organ.bloodSupply)}`,
      asset: "microscopic",
      stage: "art",
    },
    {
      id: "remember",
      kind: "remember",
      heading: "One thing to remember",
      body: sentence(organ.funFact),
      asset: "organ",
      stage: "model",
    },
  );

  // Deliberately absent: `organ.conditions`. Diseases are not part of the
  // child-facing layer, exactly as in the Ask prompt — a lesson a seven-year-old
  // opens alone must not end on a list of things that can go wrong with them.
  return steps;
}

/** How far through, for the progress row and the "3 of 11" label. */
export function lessonProgress(steps: LessonStep[], index: number) {
  return { position: Math.min(index + 1, steps.length), total: steps.length };
}

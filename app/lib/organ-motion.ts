import type { OrganId } from "./anatomy-data.ts";

/**
 * How each organ moves when nobody is touching it.
 *
 * A still model reads as an object in a case. A heart that beats reads as
 * something alive, and that is the difference between a child looking at this app
 * and a child wanting to poke it. The rhythms are the real ones, so the motion is
 * also the lesson: the heart's period here is the same number the atlas quotes as
 * 100,000 beats a day.
 *
 * Amplitudes are deliberately small. This is a 3 to 4 percent swell — plenty to
 * read as breathing at a glance, nowhere near enough to make the labels dance or
 * to look like a wobbling balloon.
 */
export type MotionKind = "heartbeat" | "breath" | "wave";

export type OrganMotion = {
  kind: MotionKind;
  /** One full cycle, in seconds. */
  period: number;
  /** Peak scale increase, as a fraction. */
  amount: number;
};

/**
 * 0.85s is about 70 beats a minute — an adult resting rate rather than a child's
 * faster one, because it has to read as a heartbeat to a parent watching too, and
 * a 110bpm model looks panicked.
 */
const HEART: OrganMotion = { kind: "heartbeat", period: 0.85, amount: 0.036 };

/** 4s is 15 breaths a minute, and slow enough to breathe along with. */
const LUNGS: OrganMotion = { kind: "breath", period: 4, amount: 0.045 };

/** Peristalsis is far slower than either, and travels rather than pulses. */
const GUT: OrganMotion = { kind: "wave", period: 6.5, amount: 0.022 };

/**
 * Everything else gets a whisper of the same breath.
 *
 * A liver does not visibly move in the body, but a model that is perfectly still
 * next to one that beats looks broken rather than accurate. This is small enough
 * to be felt rather than seen.
 */
const RESTING: OrganMotion = { kind: "breath", period: 5.5, amount: 0.013 };

const BY_ORGAN: Partial<Record<OrganId, OrganMotion>> = {
  heart: HEART,
  lungs: LUNGS,
  intestine: GUT,
};

export function organMotion(organId: OrganId): OrganMotion {
  return BY_ORGAN[organId] ?? RESTING;
}

/** A Gaussian bump, used to shape the two thumps of a heartbeat. */
function bump(phase: number, at: number, width: number) {
  const offset = (phase - at) / width;
  return Math.exp(-offset * offset);
}

/**
 * The scale multiplier for a motion at a given time.
 *
 * Returns `{ x, y, z }` rather than one number because not every organ swells
 * evenly: lungs rise more than they widen, and a peristaltic wave is a squeeze
 * that travels rather than a uniform puff.
 */
export function motionScale(motion: OrganMotion, seconds: number) {
  const phase = ((seconds % motion.period) + motion.period) % motion.period / motion.period;

  if (motion.kind === "heartbeat") {
    // Two thumps close together, then a long pause — "lub-dub, rest". A sine wave
    // here reads as a throb rather than a heartbeat, which is the whole point.
    const lub = bump(phase, 0.04, 0.055);
    const dub = 0.55 * bump(phase, 0.2, 0.07);
    const swell = 1 + motion.amount * (lub + dub);
    // Squeezes slightly taller as it narrows, the way a ventricle does.
    return { x: swell, y: 1 + motion.amount * 0.55 * (lub + dub), z: swell };
  }

  if (motion.kind === "breath") {
    // Raised cosine: no corner at either end, so the turn between in and out is
    // smooth the way a held breath is.
    const eased = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    return {
      x: 1 + motion.amount * eased * 0.75,
      y: 1 + motion.amount * eased,
      z: 1 + motion.amount * eased * 0.75,
    };
  }

  // A wave: one axis leads the other, so the shape appears to travel along the
  // tube rather than the whole thing inflating at once.
  const lead = Math.sin(phase * Math.PI * 2);
  const trail = Math.sin(phase * Math.PI * 2 - 1.1);
  return {
    x: 1 + motion.amount * lead,
    y: 1 + motion.amount * trail * 0.6,
    z: 1 + motion.amount * trail,
  };
}

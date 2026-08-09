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
  /**
   * What to call this on the sound button.
   *
   * Carried here rather than derived from `kind`, because `kind` is the shape of
   * the curve and not the name of the thing: the resting organs borrow the breath
   * curve, and labelling a liver "Breathing" is simply wrong.
   */
  label: string;
};

/**
 * 0.85s is about 70 beats a minute — an adult resting rate rather than a child's
 * faster one, because it has to read as a heartbeat to a parent watching too, and
 * a 110bpm model looks panicked.
 */
const HEART: OrganMotion = { kind: "heartbeat", period: 0.85, amount: 0.036, label: "Heartbeat" };

/** 4s is 15 breaths a minute, and slow enough to breathe along with. */
const LUNGS: OrganMotion = { kind: "breath", period: 4, amount: 0.045, label: "Breathing" };

/** Peristalsis is far slower than either, and travels rather than pulses. */
const GUT: OrganMotion = { kind: "wave", period: 6.5, amount: 0.022, label: "Rumble" };

/**
 * Everything else gets a whisper of the same breath.
 *
 * A liver does not visibly move in the body, but a model that is perfectly still
 * next to one that beats looks broken rather than accurate. This is small enough
 * to be felt rather than seen.
 */
// "Whoosh" rather than "Breathing": these organs borrow the breath curve, but what
// a liver or a kidney would actually sound like is blood moving through it, which
// is also what the filtered noise in the synth resembles.
const RESTING: OrganMotion = { kind: "breath", period: 5.5, amount: 0.013, label: "Whoosh" };

const BY_ORGAN: Partial<Record<OrganId, OrganMotion>> = {
  heart: HEART,
  lungs: LUNGS,
  intestine: GUT,
};

export function organMotion(organId: OrganId): OrganMotion {
  return BY_ORGAN[organId] ?? RESTING;
}

/**
 * The moments in one cycle when something is audible.
 *
 * Kept here rather than in the sound module so the ear and the eye cannot drift
 * apart: `at` is the same phase the corresponding bump peaks at below, so the
 * thump lands on the frame where the organ is at its fullest. Scheduling audio on
 * its own timer at the same period would look synced for a few seconds and then
 * visibly slide.
 */
export type MotionCue = {
  /** Position in the cycle, 0 to 1. */
  at: number;
  /** Relative loudness, 0 to 1. */
  strength: number;
};

export function motionCues(motion: OrganMotion): MotionCue[] {
  if (motion.kind === "heartbeat") {
    // Lub and dub, at the two bump centres.
    return [
      { at: 0.04, strength: 1 },
      { at: 0.2, strength: 0.55 },
    ];
  }
  if (motion.kind === "breath") {
    // In at the start of the rise, out at the top. Two sounds per cycle, because a
    // breath you only hear half of sounds like a leak.
    return [
      { at: 0, strength: 1 },
      { at: 0.5, strength: 0.7 },
    ];
  }
  // One soft squeeze per wave.
  return [{ at: 0.25, strength: 0.55 }];
}

/**
 * Which cues were passed between two frames.
 *
 * Separated from the render loop because the wrap is fiddly and worth testing on
 * its own: a cycle boundary falls between two frames roughly once a second, a
 * slow frame can step over a cue or an entire cycle, and `lastPhase` starts below
 * zero so that a cue sitting exactly at phase 0 is not skipped on the first pass.
 *
 * A frame long enough to span a whole period returns every cue once rather than
 * several times — a stall should not produce a machine-gun burst of heartbeats
 * when the tab comes back.
 */
export function crossedCues(cues: MotionCue[], lastPhase: number, phase: number): MotionCue[] {
  if (phase === lastPhase) return [];
  const wrapped = phase < lastPhase;
  return cues.filter((cue) =>
    wrapped ? cue.at > lastPhase || cue.at <= phase : cue.at > lastPhase && cue.at <= phase,
  );
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

import assert from "node:assert/strict";
import test from "node:test";

import { organs } from "../app/lib/anatomy-data.ts";
import { motionScale, organMotion } from "../app/lib/organ-motion.ts";

const trace = (motion, samples = 240) =>
  Array.from({ length: samples }, (_, i) => motionScale(motion, (i / samples) * motion.period));

test("every organ moves, and nothing is left perfectly still", () => {
  for (const organ of organs) {
    const motion = organMotion(organ.id);
    assert.ok(motion, `${organ.id}: no motion`);
    assert.ok(motion.period > 0, `${organ.id}: zero period`);
    assert.ok(motion.amount > 0, `${organ.id}: a still model reads as broken, not accurate`);
  }
});

test("the heart and lungs move at their real rates", () => {
  // The motion is also the lesson, so these should match what the atlas quotes.
  const heart = organMotion("heart");
  const beatsPerMinute = 60 / heart.period;
  assert.ok(beatsPerMinute > 55 && beatsPerMinute < 90, `${beatsPerMinute.toFixed(0)} bpm is not a resting rate`);

  const breathsPerMinute = 60 / organMotion("lungs").period;
  assert.ok(breathsPerMinute > 10 && breathsPerMinute < 20, `${breathsPerMinute.toFixed(0)} breaths/min is wrong`);
});

test("nothing swells enough to make the labels dance", () => {
  // The dots ride the same group, so a large amplitude moves every label with it.
  for (const organ of organs) {
    const motion = organMotion(organ.id);
    for (const scale of trace(motion)) {
      for (const axis of ["x", "y", "z"]) {
        assert.ok(scale[axis] <= 1.06, `${organ.id}: ${axis} reaches ${scale[axis].toFixed(3)}`);
        // Never shrinks: the organ sits on a plinth, and dipping below its resting
        // size makes it look like it is sinking into it.
        assert.ok(scale[axis] >= 0.97, `${organ.id}: ${axis} drops to ${scale[axis].toFixed(3)}`);
      }
    }
  }
});

test("a heartbeat is two thumps and a rest, not a throb", () => {
  const heart = organMotion("heart");
  const samples = trace(heart, 200).map((scale) => scale.x);

  // Two local maxima — lub and dub — rather than the single hump a sine gives.
  const peaks = samples.filter((value, i) => {
    const before = samples[(i - 1 + samples.length) % samples.length];
    const after = samples[(i + 1) % samples.length];
    return value > before && value >= after && value > 1 + heart.amount * 0.1;
  });
  assert.equal(peaks.length, 2, `expected lub and dub, found ${peaks.length} peaks`);
  // The second thump is the quieter one.
  assert.ok(peaks[0] > peaks[1], "the dub should be softer than the lub");

  // And most of the cycle is rest. A throb has no diastole.
  const atRest = samples.filter((value) => value < 1 + heart.amount * 0.05).length;
  assert.ok(atRest / samples.length > 0.6, `only ${Math.round((atRest / samples.length) * 100)}% of the cycle is rest`);
});

test("a breath has no corner at either end of the cycle", () => {
  // A raised cosine, so the turn between in and out is smooth. A triangle or a
  // sawtooth would visibly snap at the top of the breath.
  const lungs = organMotion("lungs");
  const samples = trace(lungs, 200).map((scale) => scale.y);
  const steps = samples.map((value, i) => Math.abs(value - samples[(i - 1 + samples.length) % samples.length]));
  const biggest = Math.max(...steps);
  const average = steps.reduce((sum, step) => sum + step, 0) / steps.length;
  assert.ok(biggest < average * 3, "the breath changes pace abruptly somewhere");
});

test("lungs rise more than they widen", () => {
  const lungs = organMotion("lungs");
  const peak = trace(lungs).reduce((best, scale) => (scale.y > best.y ? scale : best));
  assert.ok(peak.y > peak.x, "a chest expands upward more than sideways");
});

test("the wave travels rather than inflating all at once", () => {
  const gut = organMotion("intestine");
  const samples = trace(gut, 120);
  // The axes peak at different points in the cycle — that phase offset is what
  // reads as a squeeze moving along the tube.
  const peakAt = (axis) =>
    samples.reduce((best, scale, i) => (scale[axis] > samples[best][axis] ? i : best), 0);
  assert.notEqual(peakAt("x"), peakAt("z"), "every axis peaks together, so nothing travels");
});

test("every cycle wraps cleanly, forwards and backwards in time", () => {
  for (const organ of organs) {
    const motion = organMotion(organ.id);
    const start = motionScale(motion, 0);
    const wrapped = motionScale(motion, motion.period);
    for (const axis of ["x", "y", "z"]) {
      assert.ok(
        Math.abs(start[axis] - wrapped[axis]) < 1e-9,
        `${organ.id}: ${axis} jumps at the cycle boundary`,
      );
    }
    // A negative elapsed time should not fall off the curve — `clock.getDelta()`
    // starts from zero but the modulo has to cope either way.
    const negative = motionScale(motion, -motion.period * 0.25);
    for (const axis of ["x", "y", "z"]) {
      assert.ok(Number.isFinite(negative[axis]), `${organ.id}: ${axis} is not finite before zero`);
    }
  }
});

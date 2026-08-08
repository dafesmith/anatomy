import assert from "node:assert/strict";
import test from "node:test";

import { organs } from "../app/lib/anatomy-data.ts";
import { buildQuiz } from "../app/lib/quiz.ts";
import { hotspotReadings, organReadings, organDescription, hotspotReading } from "../app/lib/kid-readings.ts";

test("every question has exactly one right answer among four", () => {
  for (const organ of organs) {
    for (const question of buildQuiz(organ, organs)) {
      assert.equal(question.options.length, 4, `${organ.id}: ${question.prompt}`);
      assert.equal(new Set(question.options).size, 4, `${organ.id}: duplicate options`);
      assert.ok(question.correctIndex >= 0 && question.correctIndex < 4);
    }
  }
});

test("wrong answers come from other organs, never from this one", () => {
  // A distractor drawn from the same organ could be accidentally true, which would
  // mark a child wrong for being right.
  for (const organ of organs) {
    const own = new Set([organ.function, organ.location, organ.size, organ.tissue]);
    for (const question of buildQuiz(organ, organs)) {
      question.options.forEach((option, index) => {
        if (index === question.correctIndex) return;
        assert.ok(!own.has(option), `${organ.id}: "${option}" is also true of this organ`);
      });
    }
  }
});

test("the same organ always yields the same quiz", () => {
  // Seeded rather than random, so a child re-answering sees a stable question and
  // the behaviour is testable at all.
  for (const organ of organs.slice(0, 3)) {
    assert.deepEqual(buildQuiz(organ, organs), buildQuiz(organ, organs));
  }
});

test("every answer carries a further fact for a parent to pick up", () => {
  for (const organ of organs) {
    for (const question of buildQuiz(organ, organs)) {
      assert.ok(question.note && question.note.length > 10, `${organ.id}: thin note`);
    }
  }
});

test("every organ has child wording at both levels", () => {
  for (const organ of organs) {
    for (const level of ["simple", "standard"]) {
      const text = organReadings[organ.id]?.[level];
      assert.ok(text, `${organ.id} has no ${level} wording`);
      assert.ok(text.length > 30, `${organ.id} ${level} wording is too short to be real`);
      assert.equal(organDescription(organ.id, organ.description, level), text);
    }
    // `original` must be the atlas text untouched.
    assert.equal(
      organDescription(organ.id, organ.description, "original"),
      organ.description,
    );
  }
});

test("simple wording is genuinely simpler than the original", () => {
  const syllables = (word) => {
    const bare = word.toLowerCase().replace(/[^a-z]/g, "");
    if (bare.length <= 3) return 1;
    const groups = bare
      .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
      .replace(/^y/, "")
      .match(/[aeiouy]{1,2}/g);
    return groups ? groups.length : 1;
  };
  const hardWordShare = (text) => {
    const words = text.split(/\s+/).filter(Boolean);
    return words.filter((word) => syllables(word) >= 3).length / words.length;
  };

  for (const organ of organs) {
    const before = hardWordShare(organ.description);
    const after = hardWordShare(organReadings[organ.id].simple);
    assert.ok(
      after <= before,
      `${organ.id}: simple wording is not easier (${(after * 100).toFixed(0)}% vs ${(before * 100).toFixed(0)}% long words)`,
    );
  }
});

test("every hotspot child line points at a real hotspot", () => {
  // A typo in one of these keys would silently drop a kid line, and the callout
  // would quietly fall back to the anatomical wording with nobody noticing.
  const real = new Set(
    organs.flatMap((organ) => organ.hotspots.map((hotspot) => `${organ.id}:${hotspot.id}`)),
  );
  for (const key of Object.keys(hotspotReadings)) {
    assert.ok(real.has(key), `"${key}" matches no hotspot in the atlas`);
  }
});

test("hotspot child wording is offered at child levels and withheld at original", () => {
  const [organ] = organs;
  const covered = organ.hotspots.find((hotspot) => hotspotReadings[`${organ.id}:${hotspot.id}`]);
  assert.ok(covered, "expected the first organ to have at least one child line");
  assert.ok(hotspotReading(organ.id, covered.id, "simple"));
  assert.equal(hotspotReading(organ.id, covered.id, "original"), null);
});

import assert from "node:assert/strict";
import test from "node:test";

import { organById, organs, pluralOrganIds } from "../app/lib/anatomy-data.ts";
import { hotspotReadings } from "../app/lib/kid-readings.ts";
import { buildLesson, lessonProgress } from "../app/lib/lesson.ts";

const LEVELS = ["simple", "standard", "original"];

test("every organ has a lesson with a beginning, its parts, and an end", () => {
  for (const organ of organs) {
    for (const level of LEVELS) {
      const steps = buildLesson(organ, level);
      const kinds = steps.map((step) => step.kind);
      assert.equal(kinds[0], "place", `${organ.id}: should open on where it is`);
      assert.equal(kinds[1], "job", `${organ.id}: then what it does`);
      assert.equal(kinds.at(-1), "remember", `${organ.id}: should close on the memorable fact`);
      // One beat per labelled part, none missed and none invented.
      assert.equal(
        kinds.filter((kind) => kind === "part").length,
        organ.hotspots.length,
        `${organ.id}: wrong number of part beats`,
      );
    }
  }
});

test("step ids are unique, so read-aloud and the progress row cannot collide", () => {
  for (const organ of organs) {
    const ids = buildLesson(organ, "simple").map((step) => step.id);
    assert.equal(new Set(ids).size, ids.length, `${organ.id}: duplicate step id`);
  }
});

test("every beat carries an illustration that exists for the organ", () => {
  const assets = new Set(["organ", "microscopic", "compare", "location"]);
  for (const organ of organs) {
    for (const step of buildLesson(organ, "simple")) {
      assert.ok(assets.has(step.asset), `${organ.id}/${step.id}: unknown asset "${step.asset}"`);
    }
  }
});

test("only the beats the 3D model can actually show are 3D", () => {
  // The model is the organ on its own — no body around it, nothing beside it for
  // scale, no tissue detail — so those three beats keep the illustrations that
  // were drawn to show precisely that, and everything else turns.
  const expected = {
    place: "art",
    size: "art",
    close: "art",
    job: "model",
    part: "model",
    remember: "model",
  };
  for (const organ of organs) {
    for (const level of LEVELS) {
      for (const step of buildLesson(organ, level)) {
        assert.equal(
          step.stage,
          expected[step.kind],
          `${organ.id}/${level}/${step.id}: ${step.kind} should be ${expected[step.kind]}`,
        );
      }
    }
  }
});

test("every part beat carries the hotspot the model must swing to", () => {
  // A `model` beat with no hotspot is fine — it shows the whole organ turning — but
  // a `part` beat without one would name a structure and leave the camera wherever
  // it happened to be.
  for (const organ of organs) {
    for (const step of buildLesson(organ, "simple")) {
      if (step.kind === "part") {
        assert.ok(step.hotspotId, `${organ.id}/${step.id}: no hotspot to focus`);
        assert.equal(step.stage, "model", `${organ.id}/${step.id}: a part beat must be 3D`);
      }
      if (step.stage === "art") {
        assert.equal(step.hotspotId, undefined, `${organ.id}/${step.id}: art beat cannot focus a dot`);
      }
    }
  }
});

test("part beats name their hotspot and point back at it", () => {
  for (const organ of organs) {
    const parts = buildLesson(organ, "simple").filter((step) => step.kind === "part");
    assert.deepEqual(
      parts.map((step) => step.hotspotId),
      organ.hotspots.map((hotspot) => hotspot.id),
      `${organ.id}: part beats out of step with the hotspots`,
    );
    for (const [index, step] of parts.entries()) {
      assert.equal(step.heading, organ.hotspots[index].label);
    }
  }
});

// ---------------------------------------------------------------------------
// Prose. Every one of these is a defect that shipped in an early draft and was
// caught by reading the generated output rather than the code.
// ---------------------------------------------------------------------------

test("every beat is a whole sentence", () => {
  for (const organ of organs) {
    for (const level of LEVELS) {
      for (const step of buildLesson(organ, level)) {
        assert.match(step.body, /[.!?]$/, `${organ.id}/${level}/${step.id}: no terminal stop`);
        assert.match(step.body, /^[A-Z"“]/, `${organ.id}/${level}/${step.id}: does not open a sentence`);
        assert.ok(!/\s{2,}/.test(step.body), `${organ.id}/${level}/${step.id}: doubled space`);
      }
    }
  }
});

test("subject and verb agree, singular and plural alike", () => {
  for (const organ of organs) {
    const plural = pluralOrganIds.has(organ.id);
    for (const level of LEVELS) {
      const steps = buildLesson(organ, level);
      const all = steps.map((step) => `${step.heading} ${step.body}`).join(" ");

      // Headings: "Where are the lungs?" / "Where is the heart?"
      assert.match(
        steps[0].heading,
        plural ? /^Where are / : /^Where is /,
        `${organ.id}: opening heading disagrees`,
      );
      // The object pronoun, which "You will find they …" got wrong.
      assert.ok(!/\bfind they\b/.test(all), `${organ.id}/${level}: object pronoun should be "them"`);
      // The de-conjugated daily fact, which produced "they moves".
      assert.ok(
        !/\bthey (?:moves|filters|beats|sheds|produces|weighs|looks)\b/.test(all),
        `${organ.id}/${level}: plural subject with a singular verb`,
      );
      assert.ok(
        !/\bit (?:move|filter|beat|shed|produce|weigh|look) \b/.test(all),
        `${organ.id}/${level}: singular subject with a plural verb`,
      );
    }
  }
});

test("caption fields are never read as prose", () => {
  // `comparison` is a label — "Lungs vs. heart" — and reading it aloud as a
  // sentence produced "They weigh about About 1 kg for the pair. Lungs vs. heart."
  for (const organ of organs) {
    const size = buildLesson(organ, "simple").find((step) => step.kind === "size");
    assert.equal(size.caption, organ.comparison, `${organ.id}: comparison should be the caption`);
    assert.ok(!size.body.includes(organ.comparison), `${organ.id}: comparison leaked into the body`);
    assert.ok(!/\babout About\b/i.test(size.body), `${organ.id}: doubled "about"`);
  }
});

test("child levels use the hand-written wording, and original does not", () => {
  for (const organ of organs) {
    const covered = organ.hotspots.find((hotspot) => hotspotReadings[`${organ.id}:${hotspot.id}`]);
    if (!covered) continue;
    const kidLine = hotspotReadings[`${organ.id}:${covered.id}`];
    const find = (level) =>
      buildLesson(organ, level).find((step) => step.hotspotId === covered.id).body;

    // The kid line, with punctuation added — it is stored without a full stop.
    assert.ok(find("simple").startsWith(kidLine), `${organ.id}: child wording not used`);
    assert.equal(find("original"), `${covered.detail.replace(/\.$/, "")}.`);
  }
});

test("a lesson never mentions a disease", () => {
  // The same guarantee as the Ask prompt, enforced the same way: by not passing
  // them. A lesson a child opens alone must not end on what can go wrong.
  for (const organ of organs) {
    for (const level of LEVELS) {
      const text = buildLesson(organ, level).map((step) => `${step.heading} ${step.body}`).join(" ");
      for (const condition of organ.conditions) {
        assert.ok(!text.includes(condition), `${organ.id}/${level}: "${condition}" reached the lesson`);
      }
    }
  }
});

test("the reading level changes the words", () => {
  for (const organ of organs) {
    const simple = buildLesson(organ, "simple").map((step) => step.body).join(" ");
    const original = buildLesson(organ, "original").map((step) => step.body).join(" ");
    assert.notEqual(simple, original, `${organ.id}: level made no difference`);
  }
});

test("progress reads from one to the total and never past it", () => {
  const steps = buildLesson(organById.heart, "simple");
  assert.deepEqual(lessonProgress(steps, 0), { position: 1, total: steps.length });
  assert.deepEqual(lessonProgress(steps, steps.length - 1), {
    position: steps.length,
    total: steps.length,
  });
  // Clamped, so a stale index cannot render "12 of 11".
  assert.deepEqual(lessonProgress(steps, 99), { position: steps.length, total: steps.length });
});

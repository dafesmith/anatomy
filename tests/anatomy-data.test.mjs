import assert from "node:assert/strict";
import test from "node:test";

// Imported as TypeScript — Node strips the annotations on the fly.
import { organById, organs, systems } from "../app/lib/anatomy-data.ts";

const ids = (list) => list.map((organ) => organ.id);

test("every organ is reachable by its id", () => {
  assert.ok(organs.length > 0, "the atlas should not be empty");
  assert.equal(
    new Set(ids(organs)).size,
    organs.length,
    "organ ids must be unique",
  );

  for (const organ of organs) {
    assert.equal(organById[organ.id], organ);
  }
  assert.equal(Object.keys(organById).length, organs.length);
});

test("systems cover the organ list exactly once", () => {
  const grouped = systems.flatMap((system) => system.organs);
  assert.deepEqual(
    ids(grouped).sort(),
    ids(organs).sort(),
    "every organ should appear in exactly one system",
  );
  assert.equal(grouped.length, organs.length);
});

test("each system holds only the organs that name it", () => {
  for (const system of systems) {
    assert.ok(system.organs.length > 0, `${system.name} has no organs`);
    for (const organ of system.organs) {
      assert.equal(
        organ.system,
        system.name,
        `${organ.name} is grouped under ${system.name} but belongs to ${organ.system}`,
      );
    }
  }
});

test("each system is listed once", () => {
  const names = systems.map((system) => system.name);
  assert.equal(new Set(names).size, names.length, "system names must be unique");
  assert.deepEqual(
    new Set(names),
    new Set(organs.map((organ) => organ.system)),
  );
});

test("systems match the grouping implied by the organ list", () => {
  // Rebuilt independently so a regrouping bug cannot pass by agreeing with
  // itself; also pins the documented first-appearance ordering.
  const expected = new Map();
  for (const organ of organs) {
    expected.set(organ.system, [...(expected.get(organ.system) ?? []), organ.id]);
  }

  assert.deepEqual(
    systems.map((system) => [system.name, ids(system.organs)]),
    [...expected],
  );
  assert.ok(
    systems.some((system) => system.organs.length > 1),
    "at least one system should gather several organs",
  );
});

test("hotspot ids are unique within each organ", () => {
  for (const organ of organs) {
    const hotspotIds = organ.hotspots.map((hotspot) => hotspot.id);
    assert.ok(hotspotIds.length > 0, `${organ.name} has no hotspots`);
    assert.equal(
      new Set(hotspotIds).size,
      hotspotIds.length,
      `${organ.name} has duplicate hotspot ids`,
    );
  }
});

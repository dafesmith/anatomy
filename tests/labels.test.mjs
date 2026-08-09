import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  },
};

const { organById } = await import("../app/lib/anatomy-data.ts");
const { localLabelsStore, ownLabelsAsHotspots, isOwnLabelId, MAX_LABEL_LENGTH, LABEL_COLOURS } =
  await import("../app/lib/labels-store.ts");

const KEY = "anatomy-atelier:own-labels:v1";
const at = [0.1, 0.2, 0.3];

beforeEach(() => store.clear());

test("a label keeps the point it was placed at", async () => {
  const labels = await localLabelsStore.add({
    organId: "heart",
    label: "where my blood goes",
    position: at,
    color: LABEL_COLOURS[0],
  });
  assert.equal(labels.length, 1);
  // The position is the whole point: a screen coordinate would come unstuck the
  // moment the model turned.
  assert.deepEqual(labels[0].position, at);
  assert.equal(labels[0].organId, "heart");
});

test("labels become hotspots the viewer can render, for one organ at a time", async () => {
  await localLabelsStore.add({ organId: "heart", label: "mine", position: at, color: "#ee7c6a" });
  const labels = await localLabelsStore.add({ organId: "lungs", label: "theirs", position: at, color: "#6393d8" });

  const heart = ownLabelsAsHotspots(labels, "heart");
  assert.equal(heart.length, 1, "a label leaked across organs");
  assert.equal(heart[0].label, "mine");
  // Assignable to Hotspot, which is what lets the existing dot pipeline take them.
  assert.deepEqual(Object.keys(heart[0]).sort(), ["color", "detail", "id", "label", "position"]);
  assert.equal(heart[0].detail, "Your label", "a child should be able to tell it is theirs");
  assert.equal(ownLabelsAsHotspots(labels, "brain").length, 0);
});

test("a label's id is recognisable as the child's, not the atlas's", async () => {
  const labels = await localLabelsStore.add({ organId: "heart", label: "mine", position: at, color: "#ee7c6a" });
  assert.ok(isOwnLabelId(labels[0].id));
  // No atlas hotspot must ever be mistaken for one.
  for (const organ of Object.values(organById)) {
    for (const hotspot of organ.hotspots) {
      assert.ok(!isOwnLabelId(hotspot.id), `${hotspot.id} looks like a child's label`);
    }
  }
});

test("ids are unique even when two labels are added in the same millisecond", async () => {
  await localLabelsStore.add({ organId: "heart", label: "one", position: at, color: "#ee7c6a" });
  const labels = await localLabelsStore.add({ organId: "heart", label: "two", position: at, color: "#ee7c6a" });
  assert.equal(new Set(labels.map((l) => l.id)).size, 2, "a duplicate id would collide in the dot layer");
});

test("a long label is cut rather than allowed to fill the callout", async () => {
  const labels = await localLabelsStore.add({
    organId: "heart",
    label: "x".repeat(MAX_LABEL_LENGTH + 40),
    position: at,
    color: "#ee7c6a",
  });
  assert.equal(labels[0].label.length, MAX_LABEL_LENGTH);
});

test("removing one leaves the others", async () => {
  await localLabelsStore.add({ organId: "heart", label: "keep", position: at, color: "#ee7c6a" });
  const two = await localLabelsStore.add({ organId: "heart", label: "drop", position: at, color: "#ee7c6a" });
  const dropId = two.find((l) => l.label === "drop").id;
  const left = await localLabelsStore.remove(dropId);
  assert.deepEqual(left.map((l) => l.label), ["keep"]);
});

test("a malformed position is refused rather than handed to three.js", async () => {
  // A NaN or short position becomes a sprite at an invalid point, which silently
  // drops the entire hotspot layer out of the scene — so every dot disappears, not
  // just the bad one.
  store.set(
    KEY,
    JSON.stringify([
      { id: "own-a", organId: "heart", label: "nan", position: [0, Number.NaN, 0], color: "#ee7c6a" },
      { id: "own-b", organId: "heart", label: "short", position: [0, 1], color: "#ee7c6a" },
      { id: "own-c", organId: "heart", label: "strings", position: ["0", "1", "2"], color: "#ee7c6a" },
      { id: "own-d", organId: "heart", label: "fine", position: [0, 1, 2], color: "#ee7c6a" },
    ]),
  );
  const labels = await localLabelsStore.list();
  assert.deepEqual(labels.map((l) => l.label), ["fine"]);
});

test("labels for an organ that left the atlas are dropped", async () => {
  store.set(
    KEY,
    JSON.stringify([
      { id: "own-a", organId: "spleen", label: "gone", position: at, color: "#ee7c6a" },
      { id: "own-b", organId: "heart", label: "here", position: at, color: "#ee7c6a" },
    ]),
  );
  assert.deepEqual((await localLabelsStore.list()).map((l) => l.label), ["here"]);
});

test("an empty label is not stored, and corrupt storage does not throw", async () => {
  store.set(KEY, JSON.stringify([{ id: "own-a", organId: "heart", label: "", position: at, color: "#ee7c6a" }]));
  assert.deepEqual(await localLabelsStore.list(), []);

  store.set(KEY, "not json");
  assert.deepEqual(await localLabelsStore.list(), []);

  store.set(KEY, JSON.stringify({ notAnArray: true }));
  assert.deepEqual(await localLabelsStore.list(), []);
});

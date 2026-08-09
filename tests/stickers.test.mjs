import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

// `readLocal`/`writeLocal` look at `window` when called rather than when imported,
// so a stub installed here covers the real store instead of an extracted copy of
// its logic. Dynamic import below, so the stub is in place first.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  },
};

const { organs } = await import("../app/lib/anatomy-data.ts");
const { localStickersStore, isGold } = await import("../app/lib/stickers-store.ts");

beforeEach(() => store.clear());

test("a fresh shelf shows every organ, all empty", () => {
  return localStickersStore.list().then((shelf) => {
    assert.equal(shelf.length, organs.length, "the shelf should have a slot per organ");
    assert.deepEqual(
      shelf.map((sticker) => sticker.organId),
      organs.map((organ) => organ.id),
      "slots should follow atlas order",
    );
    // The empty slots are the mechanic — a shelf listing only what you have gives
    // a child nothing to aim at.
    assert.ok(shelf.every((sticker) => !sticker.earned), "nothing should start earned");
  });
});

test("finishing a lesson fills exactly one slot", async () => {
  const shelf = await localStickersStore.earn("heart");
  assert.equal(shelf.filter((sticker) => sticker.earned).length, 1);
  assert.ok(shelf.find((sticker) => sticker.organId === "heart").earned);
});

test("earning twice is harmless", async () => {
  await localStickersStore.earn("lungs");
  const shelf = await localStickersStore.earn("lungs");
  assert.equal(shelf.filter((sticker) => sticker.earned).length, 1, "duplicated the sticker");
});

test("gold needs the lesson finished as well as a perfect quiz", async () => {
  // A child can take a quiz without opening the lesson. A gold star on a locked,
  // greyed-out slot makes no sense, so the score is kept but the star waits.
  let shelf = await localStickersStore.recordQuiz("brain", 4, 4);
  const before = shelf.find((sticker) => sticker.organId === "brain");
  assert.equal(before.best, 4, "the score should be recorded regardless");
  assert.equal(isGold(before), false, "gold appeared on an unearned slot");

  shelf = await localStickersStore.earn("brain");
  const after = shelf.find((sticker) => sticker.organId === "brain");
  assert.equal(isGold(after), true, "the star should appear once the lesson is done");
});

test("a perfect run is gold; anything less is not", async () => {
  await localStickersStore.earn("liver");
  for (const [score, expected] of [
    [0, false],
    [3, false],
    [4, true],
  ]) {
    const shelf = await localStickersStore.recordQuiz("liver", score, 4);
    const sticker = shelf.find((entry) => entry.organId === "liver");
    // Note this runs in ascending order on purpose — see the "only improves" test
    // for what happens on the way back down.
    assert.equal(isGold(sticker), expected, `score ${score} gave gold=${isGold(sticker)}`);
  }
});

test("the best score only ever improves", async () => {
  await localStickersStore.earn("kidneys");
  await localStickersStore.recordQuiz("kidneys", 4, 4);
  // A child who aced it and then rushed a second attempt should keep their gold.
  const shelf = await localStickersStore.recordQuiz("kidneys", 1, 4);
  const sticker = shelf.find((entry) => entry.organId === "kidneys");
  assert.equal(sticker.best, 4, "a worse run overwrote the best");
  assert.equal(isGold(sticker), true, "gold was lost to a worse run");
});

test("a quiz with no questions can never be gold", async () => {
  await localStickersStore.earn("skin");
  const shelf = await localStickersStore.recordQuiz("skin", 0, 0);
  assert.equal(isGold(shelf.find((entry) => entry.organId === "skin")), false);
});

test("an organ that leaves the atlas is dropped rather than carried forward", async () => {
  store.set(
    "anatomy-atelier:stickers:v1",
    JSON.stringify({ heart: { earned: true }, spleen: { earned: true } }),
  );
  const shelf = await localStickersStore.earn("lungs");
  assert.ok(!shelf.some((sticker) => sticker.organId === "spleen"), "a stale id reached the shelf");
  // And the write-back should have removed it, not just hidden it.
  assert.ok(!JSON.parse(store.get("anatomy-atelier:stickers:v1")).spleen, "stale id still stored");
  // The real one survives.
  assert.ok(shelf.find((sticker) => sticker.organId === "heart").earned);
});

test("corrupt storage falls back to an empty shelf rather than throwing", async () => {
  store.set("anatomy-atelier:stickers:v1", "not json at all");
  const shelf = await localStickersStore.list();
  assert.equal(shelf.length, organs.length);
  assert.ok(shelf.every((sticker) => !sticker.earned));

  // An array where an object belongs is the other shape that has to not crash.
  store.set("anatomy-atelier:stickers:v1", JSON.stringify([1, 2, 3]));
  assert.equal((await localStickersStore.list()).length, organs.length);
});

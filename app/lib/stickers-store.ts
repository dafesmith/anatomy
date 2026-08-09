"use client";

import { useCallback, useEffect, useState } from "react";
// `.ts` extensions, as in `ai/prompt.ts` and `ai/providers.ts`: the test suite
// imports this module directly and Node's TypeScript loader cannot resolve an
// extensionless relative specifier at runtime. The bundler accepts either.
import { organById, organs, type OrganId } from "./anatomy-data.ts";
import { readLocal, writeLocal } from "./local-store.ts";

/**
 * The sticker shelf: one slot per organ, filled by finishing its lesson.
 *
 * Two tiers on purpose. A sticker for finishing the lesson is always reachable,
 * so a seven-year-old who engages always gets one; the gold version needs a
 * perfect quiz, which gives a reason to come back without making the base reward
 * conditional on getting things right. Perfect-only would leave most of the shelf
 * empty for the children this app is for, and "any attempt" would not feel earned.
 *
 * Async like [NotesStore] and [FavoritesStore], so a D1-backed version scoped to a
 * signed-in child can replace it without touching a caller.
 */
export type Sticker = {
  organId: OrganId;
  /** Set when the lesson was finished — this is what fills the slot. */
  earned: boolean;
  /** Best quiz score so far, out of `outOf`. Gold at full marks. */
  best: number;
  outOf: number;
};

export type StickersStore = {
  list(): Promise<Sticker[]>;
  /** Called when a lesson reaches its last beat. */
  earn(organId: OrganId): Promise<Sticker[]>;
  /** Called when a quiz finishes, whatever the score. */
  recordQuiz(organId: OrganId, score: number, outOf: number): Promise<Sticker[]>;
};

const STORAGE_KEY = "anatomy-atelier:stickers:v1";

type Stored = Record<string, { earned?: boolean; best?: number; outOf?: number }>;

function read(): Stored {
  const parsed = readLocal(STORAGE_KEY);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Stored) : {};
}

/**
 * Always returns a full shelf, in atlas order, with unearned slots included.
 *
 * The empty slots are the point — a shelf that only lists what you already have
 * gives a child nothing to aim at.
 */
function shelf(stored: Stored): Sticker[] {
  return organs.map((organ) => {
    const saved = stored[organ.id];
    return {
      organId: organ.id,
      earned: saved?.earned === true,
      best: typeof saved?.best === "number" ? saved.best : 0,
      outOf: typeof saved?.outOf === "number" ? saved.outOf : 0,
    };
  });
}

function write(stored: Stored) {
  // Unknown ids would survive an atlas change and quietly break every lookup that
  // trusts them, so they are dropped on the way out.
  const clean: Stored = {};
  for (const [id, value] of Object.entries(stored)) if (id in organById) clean[id] = value;
  writeLocal(STORAGE_KEY, clean);
}

export const localStickersStore: StickersStore = {
  async list() {
    return shelf(read());
  },
  async earn(organId) {
    const stored = read();
    stored[organId] = { ...stored[organId], earned: true };
    write(stored);
    return shelf(stored);
  },
  async recordQuiz(organId, score, outOf) {
    const stored = read();
    const previous = stored[organId];
    // Only ever improves. A child who aced it once and then rushed it should not
    // lose the gold they already have.
    const best = Math.max(previous?.best ?? 0, score);
    stored[organId] = { ...previous, best, outOf };
    write(stored);
    return shelf(stored);
  },
};

export const stickersStore: StickersStore = localStickersStore;

/**
 * Gold means earned *and* aced.
 *
 * The earned half matters: a child can take a quiz without opening the lesson, and
 * a gold star sitting on a greyed-out locked slot makes no sense. The score is
 * still recorded when it happens, so the star appears the moment the lesson is
 * finished rather than having to be won again.
 */
export function isGold(sticker: Sticker) {
  return sticker.earned && sticker.outOf > 0 && sticker.best >= sticker.outOf;
}

export function useStickers() {
  const [shelfState, setShelf] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    void stickersStore.list().then((next) => {
      if (!live) return;
      setShelf(next);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);

  const earn = useCallback(async (organId: OrganId) => {
    setShelf(await stickersStore.earn(organId));
  }, []);

  const recordQuiz = useCallback(async (organId: OrganId, score: number, outOf: number) => {
    setShelf(await stickersStore.recordQuiz(organId, score, outOf));
  }, []);

  const earnedCount = shelfState.filter((sticker) => sticker.earned).length;
  const goldCount = shelfState.filter(isGold).length;

  return { shelf: shelfState, loading, earn, recordQuiz, earnedCount, goldCount };
}

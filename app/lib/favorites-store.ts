"use client";

import { useCallback, useEffect, useState } from "react";
import { organById, type OrganId } from "./anatomy-data";
import { readLocal, writeLocal } from "./local-store";

/**
 * Saved organs, the shelf behind the library's bookmark button.
 *
 * Async for the same reason as [NotesStore]: a D1-backed implementation scoped
 * to the signed-in user can replace this without changing a caller.
 */
export type FavoritesStore = {
  list(): Promise<OrganId[]>;
  toggle(id: OrganId): Promise<OrganId[]>;
};

const STORAGE_KEY = "anatomy-atelier:favorites:v1";

function read(): OrganId[] {
  const parsed = readLocal(STORAGE_KEY);
  if (!Array.isArray(parsed)) return [];
  // An id that no longer exists in the atlas would crash every lookup that
  // trusts it, so unknown ids are dropped rather than carried forward.
  return parsed.filter((id): id is OrganId => typeof id === "string" && id in organById);
}

export const localFavoritesStore: FavoritesStore = {
  async list() {
    return read();
  },
  async toggle(id) {
    const current = read();
    const next = current.includes(id) ? current.filter((saved) => saved !== id) : [...current, id];
    writeLocal(STORAGE_KEY, next);
    return next;
  },
};

export const favoritesStore: FavoritesStore = localFavoritesStore;

export function useFavorites() {
  const [favorites, setFavorites] = useState<OrganId[]>([]);
  // Favourites only exist client-side, so the first paint has none. Tracking
  // that separately keeps "still loading" from rendering as "nothing saved".
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void favoritesStore.list().then((stored) => {
      if (cancelled) return;
      setFavorites(stored);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(async (id: OrganId) => {
    setFavorites(await favoritesStore.toggle(id));
  }, []);

  return { favorites, ready, toggle };
}

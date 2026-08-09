"use client";

/**
 * Shared localStorage plumbing for the client-only stores. Callers validate the
 * shape themselves — this only handles the two things every caller needs: the
 * server has no localStorage at all, and stored JSON may be absent or corrupt.
 *
 * ## A note on the `anatomy-atelier:` key prefix
 *
 * The app is called Look Inside; the keys still say `anatomy-atelier:` because
 * that is what is already sitting in every existing browser. Renaming them would
 * silently discard every child's stickers, notes, saved organs and their parent's
 * PIN — a data migration for a string nobody ever sees. Leave it be, and use the
 * same prefix for anything new so it all clears together.
 */
export function readLocal(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private-mode and quota failures shouldn't take a study session down; the
    // in-memory copy stays correct for the rest of the visit.
  }
}

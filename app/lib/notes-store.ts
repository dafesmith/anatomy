"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrganId } from "./anatomy-data";
import { readLocal, writeLocal } from "./local-store";

export type Note = {
  id: string;
  organId: OrganId;
  body: string;
  updatedAt: number;
};

/**
 * Storage seam for study notes. Every method is async even though the
 * localStorage implementation resolves immediately, so a D1-backed store can
 * replace it without changing a single caller.
 *
 * Swapping to D1 means: provision the `d1` binding in `.openai/hosting.json`
 * (currently `null`), declare a `notes` table in `db/schema.ts`, scope rows by
 * the email from `getChatGPTUser()`, and point `notesStore` at an
 * implementation that calls API routes instead of localStorage.
 */
export type NotesStore = {
  list(): Promise<Note[]>;
  add(organId: OrganId, body: string): Promise<Note>;
  update(id: string, body: string): Promise<void>;
  remove(id: string): Promise<void>;
};

const STORAGE_KEY = "anatomy-atelier:notes:v1";

function read(): Note[] {
  const parsed = readLocal(STORAGE_KEY);
  if (!Array.isArray(parsed)) return [];
  // Hand-edited or older payloads shouldn't take the whole view down, so
  // anything that isn't a well-formed note is dropped rather than trusted.
  return parsed.filter(
    (note): note is Note =>
      !!note &&
      typeof note === "object" &&
      typeof (note as Note).id === "string" &&
      typeof (note as Note).organId === "string" &&
      typeof (note as Note).body === "string" &&
      typeof (note as Note).updatedAt === "number",
  );
}

function write(notes: Note[]) {
  writeLocal(STORAGE_KEY, notes);
}

export const localNotesStore: NotesStore = {
  async list() {
    return read();
  },
  async add(organId, body) {
    const note: Note = {
      id: crypto.randomUUID(),
      organId,
      body,
      updatedAt: Date.now(),
    };
    write([note, ...read()]);
    return note;
  },
  async update(id, body) {
    write(read().map((note) => (note.id === id ? { ...note, body, updatedAt: Date.now() } : note)));
  },
  async remove(id) {
    write(read().filter((note) => note.id !== id));
  },
};

export const notesStore: NotesStore = localNotesStore;

/**
 * Reads notes once on mount, then keeps a local copy in step with each write so
 * the list re-renders without a second round trip to storage.
 */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  // Notes only exist client-side, so the first paint has none. Tracking that
  // separately keeps "still loading" from rendering as "you have no notes".
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void notesStore.list().then((stored) => {
      if (cancelled) return;
      setNotes(stored);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setNotes(await notesStore.list());
  }, []);

  const add = useCallback(
    async (organId: OrganId, body: string) => {
      await notesStore.add(organId, body);
      await refresh();
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, body: string) => {
      await notesStore.update(id, body);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await notesStore.remove(id);
      await refresh();
    },
    [refresh],
  );

  return { notes, ready, add, update, remove };
}

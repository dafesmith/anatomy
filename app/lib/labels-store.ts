"use client";

import { useCallback, useEffect, useState } from "react";
// `.ts` extensions for the test runner, as in the other stores.
import { organById, type Hotspot, type OrganId } from "./anatomy-data.ts";
import { readLocal, writeLocal } from "./local-store.ts";

/**
 * Labels a child puts on the model themselves.
 *
 * Pinned in three dimensions rather than drawn on a flat overlay, which is the
 * whole difference between this and a scribble: a drawing floats free the moment
 * the organ turns, where a label stays on the bit it names. Storing a point rather
 * than a screen position is what buys that.
 *
 * The shape is deliberately assignable to [Hotspot]. A child's label is handed
 * straight to the hotspot layer alongside the atlas's own, so it fades when it
 * rotates out of view, can be tapped, and opens a callout — all on the code path
 * that already existed, with no second system to keep in step.
 */
export type OwnLabel = {
  id: string;
  organId: OrganId;
  /** What the child typed. */
  label: string;
  /** In the beat group's local space — see `AnatomyViewer.pickSurface`. */
  position: [number, number, number];
  color: string;
  createdAt: number;
};

export type LabelsStore = {
  list(): Promise<OwnLabel[]>;
  add(label: Omit<OwnLabel, "id" | "createdAt">): Promise<OwnLabel[]>;
  remove(id: string): Promise<OwnLabel[]>;
};

const STORAGE_KEY = "anatomy-atelier:own-labels:v1";

/** Kept short enough to sit in a callout without becoming an essay. */
export const MAX_LABEL_LENGTH = 40;

/**
 * The colours a child can choose from.
 *
 * The atlas accents, so a label belongs to the same drawing as everything else —
 * and each is distinct enough at dot size to tell apart, which a full picker with
 * every shade of red would not be.
 */
export const LABEL_COLOURS = ["#ee7c6a", "#f2a33b", "#6393d8", "#96b78a", "#d89bc4", "#8e6dc5"];

function isPoint(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n));
}

function read(): OwnLabel[] {
  const parsed = readLocal(STORAGE_KEY);
  if (!Array.isArray(parsed)) return [];
  // Validated one field at a time rather than trusted: a malformed position would
  // be handed to three.js and put a dot at NaN, which silently removes the whole
  // hotspot layer from the scene.
  return parsed.filter(
    (entry): entry is OwnLabel =>
      !!entry &&
      typeof entry === "object" &&
      typeof entry.id === "string" &&
      typeof entry.label === "string" &&
      entry.label.length > 0 &&
      typeof entry.color === "string" &&
      typeof entry.organId === "string" &&
      entry.organId in organById &&
      isPoint(entry.position),
  );
}

export const localLabelsStore: LabelsStore = {
  async list() {
    return read();
  },
  async add(label) {
    const next = [
      ...read(),
      {
        ...label,
        label: label.label.trim().slice(0, MAX_LABEL_LENGTH),
        id: `own-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
      },
    ];
    writeLocal(STORAGE_KEY, next);
    return next;
  },
  async remove(id) {
    const next = read().filter((entry) => entry.id !== id);
    writeLocal(STORAGE_KEY, next);
    return next;
  },
};

export const labelsStore: LabelsStore = localLabelsStore;

/**
 * A child's labels for one organ, as hotspots the viewer can render.
 *
 * `detail` carries the attribution rather than being left blank, because the
 * callout shows it and "Your label" is what tells a child at a glance that this
 * one is theirs and not part of the atlas.
 */
export function ownLabelsAsHotspots(labels: OwnLabel[], organId: OrganId): Hotspot[] {
  return labels
    .filter((entry) => entry.organId === organId)
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      detail: "Your label",
      position: entry.position,
      color: entry.color,
    }));
}

/** True for a hotspot id that came from a child rather than the atlas. */
export function isOwnLabelId(id: string) {
  return id.startsWith("own-");
}

export function useOwnLabels() {
  const [labels, setLabels] = useState<OwnLabel[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    void labelsStore.list().then((next) => {
      if (!live) return;
      setLabels(next);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const add = useCallback(async (label: Omit<OwnLabel, "id" | "createdAt">) => {
    setLabels(await labelsStore.add(label));
  }, []);

  const remove = useCallback(async (id: string) => {
    setLabels(await labelsStore.remove(id));
  }, []);

  return { labels, ready, add, remove };
}

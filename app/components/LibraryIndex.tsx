"use client";

import { useMemo, useState } from "react";
import { ArrowRight, LibraryBig, Search, X } from "lucide-react";
import { OrganArt } from "./OrganArt";
import type { OrganId, ReferenceEntry, ReferenceKind } from "../lib/anatomy-data";

type Filter = ReferenceKind | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "condition", label: "Conditions" },
  { key: "tissue", label: "Tissues" },
  { key: "comparison", label: "Comparisons" },
];

const KIND_LABEL: Record<ReferenceKind, string> = {
  condition: "Condition",
  tissue: "Tissue",
  comparison: "Comparison",
};

type Props = {
  entries: ReferenceEntry[];
  onSelectOrgan: (id: OrganId) => void;
  onPrefetchOrgan: (id: OrganId) => void;
};

export function LibraryIndex({ entries, onSelectOrgan, onPrefetchOrgan }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [term, setTerm] = useState("");

  const counts = useMemo(() => {
    const tally: Record<string, number> = { all: entries.length };
    for (const entry of entries) tally[entry.kind] = (tally[entry.kind] ?? 0) + 1;
    return tally;
  }, [entries]);

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return entries.filter(
      (entry) =>
        (filter === "all" || entry.kind === filter) &&
        // Matching the organ name too means "heart" finds every heart term,
        // not just the conditions that happen to spell it out.
        (!needle || `${entry.label} ${entry.organ.name}`.toLowerCase().includes(needle)),
    );
  }, [entries, filter, term]);

  return (
    <section className="library-index" aria-label="Reference library">
      <header className="library-heading">
        <em><LibraryBig size={14} /> Reference library</em>
        <h1>Look it up by name</h1>
        <p>
          Every condition, tissue type, and comparison in the atlas — {counts.all} entries across
          the organs, searchable in one place.
        </p>
      </header>

      <div className="library-controls">
        <div className="library-filters" role="group" aria-label="Filter by entry type">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={filter === option.key ? "active" : ""}
              aria-pressed={filter === option.key}
              onClick={() => setFilter(option.key)}
            >
              {option.label} <b>{counts[option.key] ?? 0}</b>
            </button>
          ))}
        </div>
        <label className="library-search">
          <Search size={16} />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search conditions, tissues, comparisons…"
          />
          {term && (
            <button type="button" onClick={() => setTerm("")} aria-label="Clear search"><X size={14} /></button>
          )}
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="library-empty" role="status">
          Nothing matches “{term.trim()}”. Try an organ name, or a condition like “Arrhythmia”.
        </p>
      ) : (
        <ul className="library-list">
          {visible.map((entry) => (
            <li key={`${entry.kind}-${entry.label}`}>
              <button
                type="button"
                onClick={() => onSelectOrgan(entry.organ.id)}
                onPointerEnter={() => onPrefetchOrgan(entry.organ.id)}
                onFocus={() => onPrefetchOrgan(entry.organ.id)}
              >
                <span className="library-term">
                  <em>{KIND_LABEL[entry.kind]}</em>
                  <b>{entry.label}</b>
                </span>
                <span className="library-organ">
                  {/* The organ name is spelled out beside it, so the artwork
                      itself carries no extra information for a screen reader. */}
                  <span className="organ-glyph"><OrganArt organ={entry.organ} asset="thumb" alt="" size={32} /></span>
                  <span><b>{entry.organ.name}</b><small>{entry.organ.system}</small></span>
                </span>
                <ArrowRight size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

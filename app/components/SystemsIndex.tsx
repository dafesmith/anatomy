"use client";

import type { CSSProperties } from "react";
import { ArrowRight, BrainCircuit } from "lucide-react";
import { OrganArt } from "./OrganArt";
import type { BodySystem, OrganId } from "../lib/anatomy-data";

type Props = {
  systems: BodySystem[];
  /** Marks the organ already loaded in the viewer, so returning to it is obvious. */
  activeOrganId: OrganId;
  onSelectOrgan: (id: OrganId) => void;
  onPrefetchOrgan: (id: OrganId) => void;
  onFilterSystem: (system: string) => void;
};

export function SystemsIndex({
  systems,
  activeOrganId,
  onSelectOrgan,
  onPrefetchOrgan,
  onFilterSystem,
}: Props) {
  const organCount = systems.reduce((total, system) => total + system.organs.length, 0);
  return (
    <section className="systems-index" aria-label="Body systems">
      <header className="systems-heading">
        <em><BrainCircuit size={14} /> Body systems</em>
        <h1>Every system, every organ</h1>
        <p>
          {organCount} organs across {systems.length} systems. Open one to study it in 3D,
          or narrow the organ library to a single system.
        </p>
      </header>
      <div className="systems-grid">
        {systems.map((system) => (
          <article className="system-tile" key={system.name}>
            <header>
              <em>{system.organs.length === 1 ? "1 organ" : `${system.organs.length} organs`}</em>
              <h3>{system.name}</h3>
            </header>
            <ul>
              {system.organs.map((organ) => (
                <li key={organ.id}>
                  <button
                    type="button"
                    className={`system-organ ${organ.id === activeOrganId ? "active" : ""}`}
                    onClick={() => onSelectOrgan(organ.id)}
                    onPointerEnter={() => onPrefetchOrgan(organ.id)}
                    onFocus={() => onPrefetchOrgan(organ.id)}
                    style={{ "--item-accent": organ.accent } as CSSProperties}
                  >
                    {/* The organ name sits in the same button, so the artwork is
                        decorative rather than a second announcement of it. */}
                    <span className="organ-glyph">
                      <OrganArt organ={organ} asset="thumb" alt="" size={38} />
                    </span>
                    <span><b>{organ.name}</b><small>{organ.poetic}</small></span>
                    <ArrowRight size={13} />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => onFilterSystem(system.name)}>
              Filter library <ArrowRight size={14} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

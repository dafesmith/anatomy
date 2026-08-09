"use client";

import { useMemo } from "react";
import { usePrefersReducedMotion } from "../lib/use-reduced-motion";

/** The atlas accents, so a burst belongs to this app rather than a party shop. */
const COLOURS = ["#ee7c6a", "#f2a33b", "#6393d8", "#96b78a", "#d89bc4", "#8e6dc5"];

const COUNT = 26;

/**
 * A small deterministic generator, so one burst always deals the same scatter.
 *
 * mulberry32 — four lines, good enough spread for confetti, and pure, which is
 * what `Math.random()` is not.
 */
function seededRandom(seed: number) {
  // The seed is avalanched first (murmur3's finalizer). Feeding it in directly
  // made burst 2 deal burst 1's sequence shifted by one piece — consecutive seeds
  // land on adjacent states — so two right answers in a row produced two bursts
  // that were visibly the same scatter rotated.
  let state = seed | 0;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  state ^= state >>> 16;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Props = {
  /**
   * Changing this fires a fresh burst.
   *
   * Keyed from the outside rather than triggered by a prop flag, because a flag
   * has to be turned off again — and two right answers in a row would produce one
   * burst instead of two.
   */
  burst: number;
};

/**
 * A short burst of paper, for getting something right.
 *
 * DOM and CSS rather than a canvas: twenty-six spans on GPU-composited transforms
 * cost nothing next to the WebGL scene already running, and it avoids adding a
 * dependency to throw confetti.
 */
export function Confetti({ burst }: Props) {
  const reduced = usePrefersReducedMotion();

  // Seeded from the burst number rather than `Math.random()`.
  //
  // Not a style preference: `Math.random()` during render is impure, and React
  // may re-run a `useMemo` at will — a re-render mid-flight would deal every piece
  // a new angle and the burst would visibly jump. Seeding makes the scatter a pure
  // function of the burst, so a re-render produces exactly the same paper.
  const pieces = useMemo(() => {
    const random = seededRandom(burst);
    return Array.from({ length: COUNT }, (_, i) => ({
      key: `${burst}-${i}`,
      colour: COLOURS[i % COLOURS.length],
      // Fanned upward and outward, not sprayed in a full circle: gravity does
      // the rest and a full circle reads as an explosion rather than a cheer.
      angle: -90 + (random() - 0.5) * 130,
      distance: 55 + random() * 85,
      spin: (random() - 0.5) * 620,
      delay: random() * 0.09,
      size: 5 + random() * 5,
    }));
  }, [burst]);

  // Nothing at all under reduced motion. A static scatter of paper left on screen
  // would be worse than no celebration.
  if (reduced || burst === 0) return null;

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((piece) => (
        <span
          key={piece.key}
          style={
            {
              "--confetti-colour": piece.colour,
              "--confetti-angle": `${piece.angle}deg`,
              "--confetti-distance": `${piece.distance}px`,
              "--confetti-spin": `${piece.spin}deg`,
              "--confetti-delay": `${piece.delay}s`,
              "--confetti-size": `${piece.size}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

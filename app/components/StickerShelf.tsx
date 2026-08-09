"use client";

import { Lock, Star } from "lucide-react";
import { organById, type OrganId } from "../lib/anatomy-data";
import { isGold, type Sticker } from "../lib/stickers-store";
import { OrganArt } from "./OrganArt";

type Props = {
  shelf: Sticker[];
  /** Jumping to the organ is what makes an empty slot actionable. */
  onOpenOrgan: (id: OrganId) => void;
  /** Set right after one is won, so it can be picked out of the row. */
  highlight?: OrganId;
  compact?: boolean;
};

/**
 * The nine slots, earned and unearned alike.
 *
 * Showing the empty ones is the whole mechanic: a shelf listing only what a child
 * already has gives them nothing to aim at. Each empty slot is a button straight
 * to that organ, so wanting the sticker and getting to the lesson are one tap
 * apart.
 */
export function StickerShelf({ shelf, onOpenOrgan, highlight, compact = false }: Props) {
  const earned = shelf.filter((sticker) => sticker.earned).length;
  const gold = shelf.filter(isGold).length;

  return (
    <div className={`sticker-shelf ${compact ? "compact" : ""}`}>
      {!compact && (
        <p className="sticker-tally">
          <strong>
            {earned} of {shelf.length}
          </strong>{" "}
          stickers
          {gold > 0 && (
            <>
              {" · "}
              <Star size={12} /> {gold} gold
            </>
          )}
        </p>
      )}

      <ul>
        {shelf.map((sticker) => {
          const organ = organById[sticker.organId];
          const golden = isGold(sticker);
          return (
            <li key={sticker.organId}>
              <button
                type="button"
                className={`sticker ${sticker.earned ? "earned" : "locked"} ${golden ? "gold" : ""} ${
                  highlight === sticker.organId ? "just-won" : ""
                }`}
                style={{ ["--sticker-accent" as string]: organ.accent }}
                onClick={() => onOpenOrgan(sticker.organId)}
                aria-label={
                  sticker.earned
                    ? `${organ.name} sticker earned${golden ? ", gold" : ""}. Open the ${organ.name.toLowerCase()}.`
                    : `${organ.name} sticker not earned yet. Open the ${organ.name.toLowerCase()} to finish its lesson.`
                }
              >
                <span className="sticker-face">
                  <OrganArt organ={organ} asset="thumb" alt="" size={compact ? 34 : 46} />
                  {/* The padlock is the only thing distinguishing an empty slot for
                      a child who cannot yet read the label under it. */}
                  {!sticker.earned && (
                    <span className="sticker-lock">
                      <Lock size={compact ? 11 : 13} />
                    </span>
                  )}
                  {golden && (
                    <span className="sticker-star">
                      <Star size={compact ? 10 : 12} />
                    </span>
                  )}
                </span>
                <em>{organ.name}</em>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

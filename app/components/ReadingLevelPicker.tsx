"use client";

import { READING_LEVELS, type ReadingLevel } from "../lib/kid-readings";

type Props = {
  level: ReadingLevel;
  onChoose: (level: ReadingLevel) => void;
};

/**
 * Sits above the organ description, next to the words it changes, rather than in
 * the top bar — it is contextual, and the top bar is already full at tablet width.
 */
export function ReadingLevelPicker({ level, onChoose }: Props) {
  return (
    <div className="reading-picker" role="group" aria-label="Reading level">
      <span>Reading</span>
      {READING_LEVELS.map((option) => (
        <button
          key={option.key}
          type="button"
          className={level === option.key ? "active" : ""}
          aria-pressed={level === option.key}
          title={option.hint}
          onClick={() => onChoose(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

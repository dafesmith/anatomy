"use client";

import { READING_LEVELS, type ReadingLevel } from "../lib/kid-readings";
import { useVoices } from "../lib/use-speech";

type Props = {
  level: ReadingLevel;
  onChoose: (level: ReadingLevel) => void;
};

/**
 * Sits above the organ description, next to the words it changes, rather than in
 * the top bar — it is contextual, and the top bar is already full at tablet width.
 */
export function ReadingLevelPicker({ level, onChoose }: Props) {
  const { options, chosen, choose, anyHighQuality } = useVoices();

  return (
    <>
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

      {/* Only shown when there is a real choice to make. The novelty voices are
          already filtered out, so on a stock macOS this is about five entries. */}
      {options.length > 1 && (
        <div className="voice-picker">
          <label>
            <span>Voice</span>
            <select value={chosen ?? ""} onChange={(event) => choose(event.target.value)}>
              <option value="">Best available</option>
              {options.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.label}
                  {option.quality ? " ★" : ""}
                </option>
              ))}
            </select>
          </label>
          {!anyHighQuality && (
            <p>
              These are the basic system voices. For much better ones, download an
              Enhanced or Premium English voice in System Settings → Accessibility →
              Spoken Content → System Voice → Manage Voices.
            </p>
          )}
        </div>
      )}
    </>
  );
}

"use client";

import { useVoices } from "../lib/use-speech";

/**
 * Which voice reads aloud.
 *
 * Lives in the settings panel rather than beside the organ description, where it
 * used to sit. Unlike the reading level — which a child changes often, and which
 * belongs next to the words it rewrites — this is chosen once and then never
 * again, and it carries a paragraph of operating-system instructions that has no
 * business in the middle of a page about the liver.
 *
 * Deliberately *not* behind the parent PIN. Picking a voice you can stand
 * listening to is not a parental control, and a child using read-aloud should not
 * need a grown-up to change it.
 */
export function VoicePicker() {
  const { options, chosen, choose, anyHighQuality } = useVoices();

  // Nothing to choose from: one voice, or a browser with no speech at all.
  if (options.length <= 1) {
    return (
      <p className="settings-note">
        This browser has no voices to choose from, so read-aloud uses whichever one it has.
      </p>
    );
  }

  return (
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
          These are the basic system voices. For much better ones, download an Enhanced or
          Premium English voice in System Settings → Accessibility → Spoken Content → System
          Voice → Manage Voices.
        </p>
      )}
    </div>
  );
}

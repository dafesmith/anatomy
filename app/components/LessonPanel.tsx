"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, HelpCircle, Volume2 } from "lucide-react";
import type { Organ } from "../lib/anatomy-data";
import type { ReadingLevel } from "../lib/kid-readings";
import { buildLesson } from "../lib/lesson";
import { LessonStage } from "./LessonStage";
import { useSpeech } from "../lib/use-speech";
import { OrganArt } from "./OrganArt";

type Props = {
  organ: Organ;
  level: ReadingLevel;
  /** Hands over to the quiz on the closing beat, so the two views connect. */
  onTakeQuiz: () => void;
  onClose: () => void;
};

/**
 * Rendered with a `key` of the organ and reading level, so changing either
 * remounts and starts the new lesson at its first beat. Resetting the index in an
 * effect instead would render one frame on the wrong beat — or past the end of a
 * shorter lesson — before correcting itself.
 */
export function LessonPanel({ organ, level, onTakeQuiz, onClose }: Props) {
  const steps = useMemo(() => buildLesson(organ, level), [organ, level]);
  const [index, setIndex] = useState(0);
  const { supported: canSpeak, speakingId, speak, stop } = useSpeech(level);

  const step = steps[index];
  const first = index === 0;
  const last = index === steps.length - 1;

  const move = useCallback(
    (delta: number) => {
      // A beat left speaking while the picture and words change is disorienting,
      // and on a shared tablet it talks over whoever is reading.
      stop();
      setIndex((current) => Math.max(0, Math.min(steps.length - 1, current + delta)));
    },
    [steps.length, stop],
  );

  // Left and right arrows move through the lesson. The modal already traps Tab
  // and closes on Escape; this only adds the two keys a stepper implies.
  // Updating through the setter means this listener does not need re-binding on
  // every step change.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (/^(INPUT|TEXTAREA)$/.test((event.target as HTMLElement)?.tagName ?? "")) return;
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [move]);

  // Mounted once if the lesson has any 3D beat at all, so crossing between a 3D
  // beat and an illustrated one never rebuilds the context.
  const usesModel = steps.some((each) => each.stage === "model");

  // Read-aloud should speak the beat as a person would say it, heading included.
  const spoken = `${step.heading}. ${step.body}`;

  return (
    <div className="lesson-panel">
      <div className="lesson-progress" aria-hidden>
        {steps.map((each, spot) => (
          <i key={each.id} className={spot === index ? "here" : spot < index ? "past" : ""} />
        ))}
      </div>

      <p className="lesson-count">
        Step {index + 1} of {steps.length}
      </p>

      {/* The beat is a live region: moving between steps swaps the heading and
          body in place, which a screen reader would otherwise never announce. */}
      <div className="lesson-beat" role="group" aria-live="polite" aria-atomic="true">
        <div className="lesson-beat-head">
          <h3>{step.heading}</h3>
          {canSpeak && (
            <button
              type="button"
              className="speak-button"
              aria-label={speakingId === step.id ? "Stop reading" : "Read this step aloud"}
              onClick={() => speak(step.id, spoken)}
            >
              <Volume2 size={15} />
            </button>
          )}
        </div>

        <figure className="lesson-figure">
          {/* Both layers stay mounted and are stacked, rather than swapped. A
              conditional would tear down the WebGL context and re-parse the model
              every time the lesson crossed between a 3D beat and an illustrated
              one — three times a pass. The stage is told when it is hidden so it
              stops drawing instead of rendering behind the illustration. */}
          <div className="lesson-figure-visual">
            {usesModel && (
              <LessonStage
                organ={organ}
                hotspotId={step.hotspotId}
                active={step.stage === "model"}
              />
            )}
            {step.stage === "art" && (
              <OrganArt organ={organ} asset={step.asset} alt={`${organ.name} — ${step.heading}`} />
            )}
          </div>
          {step.caption && <figcaption>{step.caption}</figcaption>}
        </figure>

        <p className="lesson-body">{step.body}</p>
      </div>

      <div className="lesson-actions">
        <button type="button" className="lesson-back" onClick={() => move(-1)} disabled={first}>
          <ArrowLeft size={15} /> Back
        </button>

        {last ? (
          <button type="button" className="lesson-button" onClick={onTakeQuiz}>
            <HelpCircle size={16} /> Try the quiz
          </button>
        ) : (
          <button type="button" className="lesson-button" onClick={() => move(1)}>
            Next <ArrowRight size={16} />
          </button>
        )}
      </div>

      {last && (
        <button type="button" className="lesson-skip" onClick={onClose}>
          Back to the model
        </button>
      )}
    </div>
  );
}

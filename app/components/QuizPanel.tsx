"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, RotateCcw, Sparkles, Volume2, X } from "lucide-react";
import { buildQuiz, quizSpeech } from "../lib/quiz";
import { organs, type Organ } from "../lib/anatomy-data";
import type { ReadingLevel } from "../lib/kid-readings";
import { useSpeech } from "../lib/use-speech";
import { useStickers } from "../lib/stickers-store";
import { Confetti } from "./Confetti";

type Props = {
  organ: Organ;
  level: ReadingLevel;
  onClose: () => void;
};

export function QuizPanel({ organ, level, onClose }: Props) {
  const questions = useMemo(() => buildQuiz(organ, organs), [organ]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  /** Incremented per right answer; the number is what fires a fresh burst. */
  const [burst, setBurst] = useState(0);
  const { supported: canSpeak, speakingId, speak } = useSpeech(level);
  const { shelf, recordQuiz } = useStickers();

  const question = questions[index];
  const done = index >= questions.length;

  // Written once per run, when the last answer is in. Guarded by a ref rather than
  // by `done` alone, because "Try again" sets `done` back to false and would
  // otherwise let a second write through on the way past.
  const recorded = useRef(false);
  useEffect(() => {
    if (!done || recorded.current) return;
    recorded.current = true;
    void recordQuiz(organ.id, score, questions.length);
  }, [done, organ.id, questions.length, recordQuiz, score]);

  const choose = (option: number) => {
    if (picked !== null) return;
    setPicked(option);
    if (option !== question.correctIndex) return;
    setScore((current) => current + 1);
    setBurst((current) => current + 1);
  };

  const next = () => {
    setPicked(null);
    setIndex((current) => current + 1);
  };

  const restart = () => {
    setPicked(null);
    setScore(0);
    setIndex(0);
    recorded.current = false;
  };

  if (done) {
    const perfect = score === questions.length;
    const sticker = shelf.find((entry) => entry.organId === organ.id);
    return (
      <div className="quiz-done">
        {/* One last burst for a clean sweep, on top of the per-answer ones. */}
        {perfect && <Confetti burst={burst + 1000} />}
        <span className="quiz-score">{score} / {questions.length}</span>
        <p>
          {perfect
            ? sticker?.earned
              ? "Every one right — your sticker just went gold!"
              : "Every one right! Finish the lesson to collect the sticker."
            : score === 0
              ? "Tricky one. Have another go together."
              : "Nice work. Want to try again?"}
        </p>
        <div className="quiz-done-actions">
          <button type="button" onClick={restart}><RotateCcw size={15} /> Try again</button>
          <button type="button" className="lesson-button" onClick={onClose}>
            Keep exploring <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  const correct = picked === question.correctIndex;

  return (
    <div className="quiz-panel">
      <div className="quiz-progress" aria-hidden>
        {questions.map((_, spot) => (
          <i key={spot} className={spot === index ? "here" : spot < index ? "past" : ""} />
        ))}
      </div>

      <div className="quiz-prompt">
        <p>{question.prompt}</p>
        {canSpeak && (
          <button
            type="button"
            className="speak-button"
            // The label changes with what there is to read: before answering that is
            // the question and its four options, after it is the outcome and the fact.
            aria-label={
              speakingId === "quiz"
                ? "Stop reading"
                : picked === null
                  ? "Read the question and answers aloud"
                  : "Read the answer aloud"
            }
            onClick={() => speak("quiz", quizSpeech(question, picked))}
          >
            <Volume2 size={15} />
          </button>
        )}
      </div>

      <div className="quiz-options">
        {question.options.map((option, spot) => {
          const isCorrect = spot === question.correctIndex;
          const state = picked === null ? "" : isCorrect ? "right" : spot === picked ? "wrong" : "dim";
          return (
            <button
              key={option}
              type="button"
              className={`quiz-option ${state}`}
              onClick={() => choose(spot)}
              disabled={picked !== null}
            >
              <span className="quiz-option-number" aria-hidden>{spot + 1}</span>
              <span>{option}</span>
              {picked !== null && isCorrect && <Check size={16} />}
              {picked !== null && !isCorrect && spot === picked && <X size={16} />}
            </button>
          );
        })}
      </div>

      {/* Announced politely so a screen-reader user hears the outcome without
          losing their place in the option list. */}
      <div className="quiz-feedback" role="status" aria-live="polite">
        {picked === question.correctIndex && <Confetti burst={burst} />}
        {picked !== null && (
          <>
            <strong>{correct ? "That's right!" : "Not this time."}</strong>
            <span className="quiz-note"><Sparkles size={14} /> {question.note}</span>
            <button type="button" className="lesson-button" onClick={next}>
              {index === questions.length - 1 ? "See how you did" : "Next question"}{" "}
              <ArrowRight size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

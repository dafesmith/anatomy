"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, RotateCcw, Sparkles, Volume2, X } from "lucide-react";
import { buildQuiz } from "../lib/quiz";
import { organs, type Organ } from "../lib/anatomy-data";
import type { ReadingLevel } from "../lib/kid-readings";
import { useSpeech } from "../lib/use-speech";

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
  const { supported: canSpeak, speakingId, speak } = useSpeech(level);

  const question = questions[index];
  const done = index >= questions.length;

  const choose = (option: number) => {
    if (picked !== null) return;
    setPicked(option);
    if (option === question.correctIndex) setScore((current) => current + 1);
  };

  const next = () => {
    setPicked(null);
    setIndex((current) => current + 1);
  };

  const restart = () => {
    setPicked(null);
    setScore(0);
    setIndex(0);
  };

  if (done) {
    return (
      <div className="quiz-done">
        <span className="quiz-score">{score} / {questions.length}</span>
        <p>
          {score === questions.length
            ? "Every one right. Try another organ!"
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
            aria-label={speakingId === "quiz" ? "Stop reading" : "Read the question aloud"}
            onClick={() => speak("quiz", question.prompt)}
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

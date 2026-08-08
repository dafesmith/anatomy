"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader, ShieldAlert, Sparkles, Volume2, X } from "lucide-react";
import { suggestedQuestions } from "../lib/ai/prompt";
import { useConversation } from "../lib/ai/use-conversation";
import { useSpeech } from "../lib/use-speech";
import type { Organ } from "../lib/anatomy-data";
import type { ReadingLevel } from "../lib/kid-readings";

type Props = {
  organ: Organ;
  hotspotId?: string;
  level: ReadingLevel;
  /** Off means the suggested buttons only — a grown-up decision. */
  allowTyping: boolean;
  /** Set when the child tapped the model where there is no label. */
  unlabelled?: boolean;
  /** A still ringed at the tap point, taken at the moment of the tap rather than
   *  when the question is sent — by then the organ may have rotated away. */
  image?: string;
  onClose: () => void;
};

export function AskPanel({
  organ,
  hotspotId,
  level,
  allowTyping,
  unlabelled,
  image,
  onClose,
}: Props) {
  const { messages, pending, error, provider, ask } = useConversation();
  const { supported: canSpeak, speakingId, speak } = useSpeech(level);
  const [draft, setDraft] = useState("");
  // Asked when the panel opens, so a grown-up sees the canned-answers warning
  // before a child asks rather than after the first reply.
  const [configured, setConfigured] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const suggestions = suggestedQuestions({ organId: organ.id, hotspotId, level });
  const usingStub = (provider ?? configured) === "stub";

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch("/api/ask");
        if (!response.ok) return;
        const payload = (await response.json()) as { provider?: string };
        if (!cancelled && payload.provider) setConfigured(payload.provider);
      } catch {
        // No answer means no warning to show; the panel still works.
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the newest answer in view without yanking the whole page around.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, pending]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const send = (question: string) => {
    void ask({
      organId: organ.id,
      hotspotId,
      level,
      question,
      unlabelled,
      // The picture only rides along for the one case the app can't answer itself.
      image: unlabelled ? image : undefined,
    });
    setDraft("");
  };

  return (
    <section className="ask-panel" aria-label={`Ask about the ${organ.name.toLowerCase()}`}>
      <header>
        <span>
          <em>Asking about</em>
          <b>{hotspotId ? organ.hotspots.find((h) => h.id === hotspotId)?.label ?? organ.name : organ.name}</b>
        </span>
        <button type="button" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </header>

      {usingStub && (
        // Said plainly, because an answer a parent believes came from a model
        // when it did not is worse than no answer at all.
        <p className="ask-stub-note">
          No model is connected yet, so these replies are canned examples — not real answers.
        </p>
      )}

      <div className="ask-messages" ref={listRef}>
        {messages.length === 0 && !pending && (
          <p className="ask-empty">Pick a question, or ask your own.</p>
        )}
        {messages.map((message) =>
          message.role === "user" ? (
            <p key={message.id} className="ask-question">{message.text}</p>
          ) : (
            <div key={message.id} className={`ask-answer ${message.needsGrownUp ? "grown-up" : ""}`}>
              {message.needsGrownUp && (
                <span className="ask-grownup-flag"><ShieldAlert size={13} /> One to talk about together</span>
              )}
              <p>{message.text}</p>
              {canSpeak && (
                <button
                  type="button"
                  className="speak-button"
                  aria-label={speakingId === message.id ? "Stop reading" : "Read this answer aloud"}
                  onClick={() => speak(message.id, message.text)}
                >
                  <Volume2 size={14} />
                </button>
              )}
            </div>
          ),
        )}
        {pending && (
          <p className="ask-thinking" role="status"><Loader size={14} /> Thinking…</p>
        )}
      </div>

      {error && <p className="ask-error" role="alert">{error}</p>}

      <div className="ask-suggestions">
        {suggestions.map((question) => (
          <button key={question} type="button" disabled={pending} onClick={() => send(question)}>
            <Sparkles size={12} /> {question}
          </button>
        ))}
      </div>

      {allowTyping && (
        <form
          className="ask-compose"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Ask about the ${organ.name.toLowerCase()}…`}
            maxLength={300}
            aria-label="Your question"
          />
          <button type="submit" disabled={pending || !draft.trim()} aria-label="Send question">
            <ArrowUp size={16} />
          </button>
        </form>
      )}
    </section>
  );
}

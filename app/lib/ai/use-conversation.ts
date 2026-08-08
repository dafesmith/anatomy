"use client";

import { useCallback, useRef, useState } from "react";
import type { OrganId } from "../anatomy-data";
import type { ReadingLevel } from "../kid-readings";

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Set on an answer that a grown-up should see — rendered differently. */
  needsGrownUp?: boolean;
};

export type AskInput = {
  organId: OrganId;
  hotspotId?: string;
  level: ReadingLevel;
  question: string;
  /** Set when the tap landed on the model but on no label. */
  unlabelled?: boolean;
  /** A capture, ringed at the tap point. Only sent for an unlabelled tap. */
  image?: string;
  tools?: string[];
};

let counter = 0;
const nextId = () => `m${(counter += 1)}`;

/**
 * The conversation, held for as long as the panel is open.
 *
 * The whole exchange travels with each question, which is what stops it losing
 * the thread when a child asks "but why?" for the fourth time. The route caps how
 * far back it will look, generously — see MAX_HISTORY_TURNS.
 */
export function useConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Which provider answered, so the UI can be honest when it is the stub. */
  const [provider, setProvider] = useState<string | null>(null);
  // Read inside the request rather than from state, so a question asked while an
  // earlier answer is still arriving still carries the full history.
  const messagesRef = useRef<Message[]>([]);
  const inFlight = useRef<AbortController | null>(null);

  const commit = useCallback((next: Message[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const ask = useCallback(
    async (input: AskInput) => {
      const question = input.question.trim();
      if (!question || pending) return;

      setError(null);
      setPending(true);
      const asked: Message = { id: nextId(), role: "user", text: question };
      commit([...messagesRef.current, asked]);

      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            organId: input.organId,
            hotspotId: input.hotspotId,
            level: input.level,
            unlabelled: input.unlabelled,
            image: input.image,
            tools: input.tools,
            question,
            history: messagesRef.current
              .filter((message) => message.id !== asked.id)
              .map((message) => ({ role: message.role, content: message.text })),
          }),
        });

        const payload = (await response.json()) as {
          answer?: string;
          needsGrownUp?: boolean;
          provider?: string;
          error?: string;
        };

        if (!response.ok) {
          setError(payload.error ?? "Something went wrong. Try again?");
          // Drop the question that never got an answer, so a retry isn't sent twice.
          commit(messagesRef.current.filter((message) => message.id !== asked.id));
          return;
        }

        setProvider(payload.provider ?? null);
        commit([
          ...messagesRef.current,
          {
            id: nextId(),
            role: "assistant",
            text: payload.answer ?? "",
            needsGrownUp: payload.needsGrownUp === true,
          },
        ]);
      } catch (caught) {
        if ((caught as Error).name === "AbortError") return;
        setError("I couldn't reach the answer just then.");
        commit(messagesRef.current.filter((message) => message.id !== asked.id));
      } finally {
        setPending(false);
      }
    },
    [commit, pending],
  );

  const reset = useCallback(() => {
    inFlight.current?.abort();
    commit([]);
    setError(null);
    setPending(false);
  }, [commit]);

  return { messages, pending, error, provider, ask, reset };
}

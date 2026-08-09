"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, LockOpen, ShieldAlert, SlidersHorizontal, X } from "lucide-react";
import { pinAvailable, useParentLock } from "../lib/parent-lock-store";
import { VoicePicker } from "./VoicePicker";

type Props = { onClose: () => void };

const PIN_LENGTH = 4;

export function GrownUpSettings({ onClose }: Props) {
  const { hasPin, unlocked, settings, setPin, unlock, lock, update, forgetPin } = useParentLock();
  const [entry, setEntry] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const supported = pinAvailable();

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const digitsOnly = (value: string) => value.replace(/\D/g, "").slice(0, PIN_LENGTH);

  const create = async () => {
    if (entry.length !== PIN_LENGTH) return setError(`Use ${PIN_LENGTH} digits.`);
    if (entry !== confirm) return setError("Those two don't match.");
    setBusy(true);
    await setPin(entry);
    setBusy(false);
    setEntry("");
    setConfirm("");
    setError(null);
  };

  const tryUnlock = async () => {
    setBusy(true);
    const ok = await unlock(entry);
    setBusy(false);
    setEntry("");
    setError(ok ? null : "That PIN isn't right.");
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="learning-modal grown-up-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grownup-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        {/* Sliders rather than a padlock: only the lower half of this panel is
            locked now, and a padlock at the top implies the whole thing is. */}
        <span className="modal-icon"><SlidersHorizontal size={22} /></span>
        <em>Preferences</em>
        <h2 id="grownup-title">Settings</h2>

        {/* Ahead of the PIN, deliberately. Choosing a voice you can bear listening
            to is not a parental control, and a child using read-aloud should not
            have to fetch a grown-up to change it. Only what follows the lock is
            actually gated. */}
        <section className="settings-group">
          <h3>Reading aloud</h3>
          <VoicePicker />
        </section>

        <div className="settings-group settings-group-locked" ref={panelRef}>
          <h3>
            {unlocked ? <LockOpen size={13} /> : <Lock size={13} />} Grown-ups only
          </h3>
          {!supported ? (
            <p className="grownup-note">
              This browser can’t store a PIN securely, so the settings below stay at their safe
              defaults. Everything still works — conditions stay hidden.
            </p>
          ) : !hasPin ? (
            <>
              <p className="grownup-note">
                Pick a {PIN_LENGTH}-digit PIN. It keeps the settings below out of a child’s reach
                and is only needed to change them.
              </p>
              <label className="pin-field">
                <span>New PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={entry}
                  onChange={(event) => setEntry(digitsOnly(event.target.value))}
                />
              </label>
              <label className="pin-field">
                <span>Again</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={confirm}
                  onChange={(event) => setConfirm(digitsOnly(event.target.value))}
                  onKeyDown={(event) => event.key === "Enter" && void create()}
                />
              </label>
              {error && <p className="pin-error" role="alert">{error}</p>}
              <button className="lesson-button" disabled={busy} onClick={() => void create()}>
                Set PIN
              </button>
            </>
          ) : !unlocked ? (
            <>
              <p className="grownup-note">Enter your PIN to change these settings.</p>
              <label className="pin-field">
                <span>PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={entry}
                  onChange={(event) => setEntry(digitsOnly(event.target.value))}
                  onKeyDown={(event) => event.key === "Enter" && void tryUnlock()}
                />
              </label>
              {error && <p className="pin-error" role="alert">{error}</p>}
              <button className="lesson-button" disabled={busy} onClick={() => void tryUnlock()}>
                Unlock
              </button>
              <button className="pin-forget" onClick={forgetPin}>
                Forgotten it? Clear the PIN and start over
              </button>
            </>
          ) : (
            <>
              <label className="grownup-toggle">
                <span>
                  <b>Show medical conditions</b>
                  <small>
                    The 72 conditions in the Library — stroke, cancer, heart failure. Hidden while a
                    child reading level is on.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.showConditions}
                  onChange={(event) => update({ showConditions: event.target.checked })}
                />
              </label>

              <label className="grownup-toggle">
                <span>
                  <b>Let them ask questions</b>
                  <small>
                    A child can ask about the organ on screen and hear the answer. Only ever about
                    what is on the screen — never about symptoms or illness.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.askEnabled}
                  onChange={(event) => update({ askEnabled: event.target.checked })}
                />
              </label>

              {/* Only shown once asking is on, because on its own it controls nothing —
                  a disabled toggle for a feature that is itself off reads as broken. */}
              {settings.askEnabled && (
                <label className="grownup-toggle grownup-toggle-nested">
                  <span>
                    <b>Allow typing</b>
                    <small>
                      Off means the suggested buttons only, which is safer and easier for a younger
                      child. On lets them type their own question.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.freeTypingEnabled}
                    onChange={(event) => update({ freeTypingEnabled: event.target.checked })}
                  />
                </label>
              )}

              {/* Said plainly rather than buried: a parent who thinks this is a real
                  lock will trust it further than it deserves. */}
              <div className="grownup-warning">
                <ShieldAlert size={16} />
                <p>
                  This PIN stops a young child changing these settings. It is not real security —
                  an older child who clears the browser’s site data will reset it.
                </p>
              </div>

              <button className="lesson-button" onClick={lock}>
                <Lock size={15} /> Lock again
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

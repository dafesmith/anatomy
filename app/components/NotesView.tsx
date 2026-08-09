"use client";

import { useState, type CSSProperties } from "react";
import { ArrowRight, NotebookPen, Pencil, Sticker, Trash2, X } from "lucide-react";
import { OrganArt } from "./OrganArt";
import { useNotes } from "../lib/notes-store";
import { useStickers } from "../lib/stickers-store";
import { StickerShelf } from "./StickerShelf";
import { organById, organs, type OrganId } from "../lib/anatomy-data";

type Props = {
  /** Seeds the composer with whatever is loaded in the viewer. */
  currentOrganId: OrganId;
  onSelectOrgan: (id: OrganId) => void;
};

function formatStamp(updatedAt: number) {
  return new Date(updatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function NotesView({ currentOrganId, onSelectOrgan }: Props) {
  const { notes, ready, add, update, remove } = useNotes();
  const { shelf, loading: stickersLoading } = useStickers();
  const stickersReady = !stickersLoading;
  const [target, setTarget] = useState<OrganId>(currentOrganId);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    await add(target, body);
    setDraft("");
  };

  const commitEdit = async (id: string) => {
    const body = editDraft.trim();
    // An emptied note is a delete in disguise; treat it as a no-op instead of
    // silently storing a blank card the user can't see or find again.
    if (body) await update(id, body);
    setEditingId(null);
  };

  return (
    <section className="notes-view" aria-label="Study notes">
      <header className="notes-heading">
        <em><NotebookPen size={14} /> Study notes</em>
        <h1>What you want to remember</h1>
        <p>
          Notes are attached to an organ, so they come back with it. They are saved in this
          browser only — clearing site data removes them.
        </p>
      </header>

      {/* Above the notes, because it is the thing a child came here to look at.
          Every slot is a button to that organ, so an empty one is an invitation
          rather than a reproach. */}
      <section className="sticker-section" aria-label="Sticker shelf">
        <h2>
          <Sticker size={15} /> Your stickers
        </h2>
        <p>Finish an organ&rsquo;s lesson to collect its sticker. Get every quiz question right and it turns gold.</p>
        {stickersReady && <StickerShelf shelf={shelf} onOpenOrgan={onSelectOrgan} />}
      </section>

      <form
        className="note-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="note-organ-picker">
          <span>Organ</span>
          <select value={target} onChange={(event) => setTarget(event.target.value as OrganId)}>
            {organs.map((organ) => (
              <option key={organ.id} value={organ.id}>{organ.name}</option>
            ))}
          </select>
        </label>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Something to remember about the ${organById[target].name.toLowerCase()}…`}
          rows={3}
          aria-label="Note text"
        />
        <button type="submit" className="lesson-button" disabled={!draft.trim()}>
          Save note <ArrowRight size={16} />
        </button>
      </form>

      {!ready ? (
        <p className="notes-empty" role="status">Loading your notes…</p>
      ) : notes.length === 0 ? (
        <p className="notes-empty">
          No notes yet. Write your first one above — it will show up here and stay with its organ.
        </p>
      ) : (
        <ul className="notes-list">
          {notes.map((note) => {
            const organ = organById[note.organId];
            return (
              <li key={note.id} style={{ "--item-accent": organ.accent } as CSSProperties}>
                <header>
                  <button
                    type="button"
                    className="note-organ"
                    onClick={() => onSelectOrgan(note.organId)}
                    aria-label={`Open the ${organ.name.toLowerCase()} in the viewer`}
                  >
                    <span className="organ-glyph"><OrganArt organ={organ} asset="thumb" alt="" size={30} /></span>
                    <span><b>{organ.name}</b><small>{formatStamp(note.updatedAt)}</small></span>
                  </button>
                  <span className="note-actions">
                    {editingId === note.id ? (
                      <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel edit"><X size={15} /></button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(note.id);
                          setEditDraft(note.body);
                        }}
                        aria-label={`Edit note about the ${organ.name.toLowerCase()}`}
                      ><Pencil size={14} /></button>
                    )}
                    <button
                      type="button"
                      className="note-delete"
                      onClick={() => void remove(note.id)}
                      aria-label={`Delete note about the ${organ.name.toLowerCase()}`}
                    ><Trash2 size={14} /></button>
                  </span>
                </header>
                {editingId === note.id ? (
                  <div className="note-edit">
                    <textarea
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.target.value)}
                      rows={3}
                      aria-label="Edit note text"
                      autoFocus
                    />
                    <button type="button" onClick={() => void commitEdit(note.id)} disabled={!editDraft.trim()}>
                      Save changes
                    </button>
                  </div>
                ) : (
                  <p>{note.body}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

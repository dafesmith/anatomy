"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  BrainCircuit,
  ChevronDown,
  CircleHelp,
  Compass,
  FileText,
  Heart,
  LibraryBig,
  Microscope,
  NotebookPen,
  Play,
  Search,
  Share2,
  Sparkles,
  Square,
  Stethoscope,
  Volume2,
  X,
} from "lucide-react";
import { OrganViewer } from "./OrganViewer";
import { OrganArt } from "./OrganArt";
import { SystemsIndex } from "./SystemsIndex";
import { LibraryIndex } from "./LibraryIndex";
import { NotesView } from "./NotesView";
import { useFavorites } from "../lib/favorites-store";
import { useReadingLevel } from "../lib/reading-level-store";
import { useParentLock } from "../lib/parent-lock-store";
import { GrownUpSettings } from "./GrownUpSettings";
import { AskPanel } from "./AskPanel";
import { useSpeech } from "../lib/use-speech";
import { organDescription, type ReadingLevel } from "../lib/kid-readings";
import { ReadingLevelPicker } from "./ReadingLevelPicker";
import { QuizPanel } from "./QuizPanel";
import { organById, organs, referenceIndex, systems, type Organ, type OrganId } from "../lib/anatomy-data";

type Modal = "lesson" | "quiz" | "animation" | "system" | null;
type View = "explore" | "systems" | "library" | "notes";

export function AnatomyApp() {
  const [organId, setOrganId] = useState<OrganId>("heart");
  const [view, setView] = useState<View>("explore");
  const [autoRotate, setAutoRotate] = useState(true);
  const [compare, setCompare] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [mobileLibrary, setMobileLibrary] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const prefetched = useRef(new Set<OrganId>());
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const { level, choose: chooseLevel } = useReadingLevel();
  const { settings: parentSettings } = useParentLock();
  const [grownUpOpen, setGrownUpOpen] = useState(false);
  const [asking, setAsking] = useState<{ hotspotId?: string; unlabelled?: boolean; image?: string } | null>(null);
  const { supported: canSpeak, speakingId, speak, stop: stopSpeaking } = useSpeech(level);
  const organ = organById[organId];
  const reference = organById[organId === "heart" ? "brain" : "heart"];
  const saved = favorites.includes(organId);
  const description = organDescription(organId, organ.description, level);
  // Diseases are hidden while a child level is on, unless a grown-up allowed them.
  // At `original` the reader is an adult, so there is nothing to gate.
  const conditionsHidden = level !== "original" && !parentSettings.showConditions;
  const libraryEntries = conditionsHidden
    ? referenceIndex.filter((entry) => entry.kind !== "condition")
    : referenceIndex;
  // Read as one passage rather than six clipped fragments, so it sounds like a
  // sentence instead of a list being dictated.
  const factsAloud = `${organ.name}. Size: ${organ.size}. Weight: ${organ.weight}. Every day: ${organ.dailyFact}. Where it is: ${organ.location}. What it does: ${organ.function}.`;
  const filteredOrgans = useMemo(
    () =>
      organs.filter(
        (item) =>
          `${item.name} ${item.system}`.toLowerCase().includes(query.toLowerCase()) &&
          (!savedOnly || favorites.includes(item.id)),
      ),
    [query, savedOnly, favorites],
  );

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(contentRef.current.querySelectorAll("[data-reveal]"),
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.48, stagger: 0.035, ease: "power2.out", overwrite: true },
    );
  }, [organId]);

  const selectOrgan = (id: OrganId) => {
    if (organById[id].illustrated) {
      ["organ", "microscopic", "compare", "location"].forEach((asset) => {
        const image = new Image();
        image.src = `/anatomy/${id}/${asset}.webp`;
      });
    }
    // A voice mid-sentence about the old organ would keep talking over the new one.
    stopSpeaking();
    setOrganId(id);
    setMobileLibrary(false);
    setCompare(false);
  };

  // Warms the model in the HTTP cache while the pointer is still travelling,
  // so the switch usually renders without a visible loading pass.
  const prefetchOrgan = (id: OrganId) => {
    if (id === organId || prefetched.current.has(id)) return;
    prefetched.current.add(id);
    void fetch(organById[id].model, { priority: "low" } as RequestInit).catch(() => {});
  };

  // Shared by every index view. Clears any leftover filter so the organ library
  // comes back whole around the organ just picked, rather than hiding it behind
  // an earlier search term.
  const openOrganFromIndex = (id: OrganId) => {
    setQuery("");
    selectOrgan(id);
    setView("explore");
  };

  // The library filter already matches on `name` + `system`, so handing it the
  // system name narrows the list to exactly that system — and leaves the term
  // visible in the search box, which "View all organs" clears.
  const filterBySystem = (system: string) => {
    setQuery(system);
    setView("explore");
  };

  return (
    <main className="app-shell" data-reading={level}>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => selectOrgan("heart")} aria-label="Anatomy Atelier home">
          <strong>Anatomy Atelier<sup>✦</sup></strong>
          <em>Learn anatomy like an artist</em>
        </button>
        {/* Every label carries an aria-label as well as visible text: the
            narrow breakpoints hide the <span>, and hidden text is absent from
            the accessibility tree, which would leave these buttons unnamed. */}
        <nav className="main-nav" aria-label="Primary navigation">
          <button
            className={view === "explore" ? "active" : ""}
            aria-current={view === "explore" ? "page" : undefined}
            aria-label="Explore"
            onClick={() => setView("explore")}
          ><Compass size={17} /> <span>Explore</span></button>
          <button
            className={view === "systems" ? "active" : ""}
            aria-current={view === "systems" ? "page" : undefined}
            aria-label="Systems"
            onClick={() => setView("systems")}
          ><BrainCircuit size={17} /> <span>Systems</span></button>
          <button aria-label="Lessons" onClick={() => setModal("lesson")}><BookOpen size={17} /> <span>Lessons</span></button>
          <button
            className={view === "library" ? "active" : ""}
            aria-current={view === "library" ? "page" : undefined}
            aria-label="Library"
            onClick={() => setView("library")}
          ><LibraryBig size={17} /> <span>Library</span></button>
          <button
            className={view === "notes" ? "active" : ""}
            aria-current={view === "notes" ? "page" : undefined}
            aria-label="Notes"
            onClick={() => setView("notes")}
          ><NotebookPen size={17} /> <span>Notes</span></button>
        </nav>
        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search organs, topics…" />
        </label>
        <button className="profile" aria-label="Open grown-up settings" onClick={() => setGrownUpOpen(true)}><span>MA</span><ChevronDown size={15} /></button>
        <button className="mobile-library-trigger" onClick={() => setMobileLibrary(true)} aria-label="Open organ library"><LibraryBig size={20} /></button>
      </header>

      {/* Hidden rather than unmounted: the viewer's own IntersectionObserver
          idles the render loop while it is off-screen, so keeping it mounted
          costs nothing and preserves both the WebGL context and the parsed
          models already in the asset cache. */}
      <div className="workspace" hidden={view !== "explore"}>
        <aside className={`organ-library ${mobileLibrary ? "open" : ""}`}>
          <div className="panel-heading">
            <span>Organ library</span>
            <button aria-label="Close library" className="mobile-close" onClick={() => setMobileLibrary(false)}><X size={17} /></button>
            <button
              className={savedOnly ? "active" : ""}
              aria-pressed={savedOnly}
              aria-label={savedOnly ? "Show all organs" : "Show only saved organs"}
              onClick={() => setSavedOnly(!savedOnly)}
            ><Bookmark size={17} fill={savedOnly ? "currentColor" : "none"} /></button>
          </div>
          <div className="organ-list">
            {filteredOrgans.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`organ-item ${organId === item.id ? "active" : ""}`}
                onClick={() => selectOrgan(item.id)}
                onPointerEnter={() => prefetchOrgan(item.id)}
                onFocus={() => prefetchOrgan(item.id)}
                style={{ "--item-accent": item.accent } as React.CSSProperties}
              >
                <span className="organ-glyph">
                  <OrganArt organ={item} asset="thumb" alt={`${item.name} thumbnail`} size={47} />
                </span>
                <span><b>{item.name}</b><small>{item.system}</small></span>
                <span className="organ-markers">
                  {/* Saved state has to be announced — it isn't visible from the
                      row's own label — while the selected dot only restates what
                      `.organ-item.active` already shows visually. */}
                  {favorites.includes(item.id) && (
                    <Bookmark className="organ-saved" size={13} fill="currentColor" aria-label="Saved" role="img" />
                  )}
                  {organId === item.id && <span className="organ-selected" aria-hidden />}
                </span>
              </button>
            ))}
          </div>
          {savedOnly && filteredOrgans.length === 0 && (
            <p className="organ-list-empty" role="status">
              Nothing saved yet. Open an organ and choose <b>Save</b> to keep it here.
            </p>
          )}
          <button className="view-all" onClick={() => setQuery("")}>View all organs <ArrowRight size={14} /></button>
          <blockquote>
            <Sparkles size={18} />
            <p>Learning is<br />an act of curiosity.</p>
            <em>Keep exploring!</em>
          </blockquote>
        </aside>

        <OrganViewer
          organ={organ}
          autoRotate={autoRotate}
          onAutoRotate={setAutoRotate}
          compare={compare}
          onCompare={() => setCompare(!compare)}
          level={level}
          askEnabled={parentSettings.askEnabled}
          onAsk={setAsking}
        />

        <aside className="info-panel" ref={contentRef}>
          <div className="info-kicker" data-reveal><Heart size={13} fill="currentColor" /> The {organ.name}</div>
          <div className="info-title-row" data-reveal>
            <div><h1>{organ.name}</h1><em>{organ.poetic}</em></div>
            <span className="specimen-stamp">
              <OrganArt organ={organ} asset="organ" alt={`${organ.name} anatomical illustration`} size={92} />
            </span>
          </div>
          <div className="reading-row" data-reveal><ReadingLevelPicker level={level} onChoose={chooseLevel} /></div>
          <div className="description-row" data-reveal>
            <p className="description">{description}</p>
            {canSpeak && (
              <button
                type="button"
                className="speak-button"
                aria-label={speakingId === "description" ? "Stop reading" : `Read about the ${organ.name.toLowerCase()} aloud`}
                onClick={() => speak("description", description)}
              >
                {speakingId === "description" ? <Square size={15} /> : <Volume2 size={15} />}
              </button>
            )}
          </div>
          {/* The grown-up wording stays on the page at the kid levels, so a parent
              reading along still sees the real sentence without taking the child's
              screen off the simple one. */}
          {level !== "original" && (
            <details className="grown-up-copy" data-reveal>
              <summary>For grown-ups</summary>
              <p>{organ.description}</p>
            </details>
          )}
          <div className="rule" />
          <div className="facts-heading" data-reveal>
            <h2>Key facts</h2>
            {canSpeak && (
              <button
                type="button"
                className="speak-button"
                aria-label={speakingId === "facts" ? "Stop reading" : "Read all the key facts aloud"}
                onClick={() => speak("facts", factsAloud)}
              >
                {speakingId === "facts" ? <Square size={15} /> : <Volume2 size={15} />}
              </button>
            )}
          </div>
          <dl className="key-facts">
            <div data-reveal><dt><span>◇</span> Size</dt><dd>{organ.size}</dd></div>
            <div data-reveal><dt><span>♙</span> Weight</dt><dd>{organ.weight}</dd></div>
            <div data-reveal><dt><span>⌁</span> Daily</dt><dd>{organ.dailyFact}</dd></div>
            <div data-reveal><dt><span>⌖</span> Location</dt><dd>{organ.location}</dd></div>
            <div data-reveal><dt><span>❋</span> Blood supply</dt><dd>{organ.bloodSupply}</dd></div>
            <div data-reveal><dt><span>◈</span> Function</dt><dd>{organ.function}</dd></div>
          </dl>
          <div className="medical-note" data-reveal><Stethoscope size={16} /><p><b>Medical importance</b>{organ.medical}</p></div>
          <div className="fun-note" data-reveal><Sparkles size={15} /><p><b>Did you know</b>{organ.funFact}</p></div>
          <button className="lesson-button" data-reveal onClick={() => setModal("lesson")}>View lesson <ArrowRight size={16} /></button>
          <div className="action-grid" data-reveal>
            <button onClick={() => setModal("animation")}><Play size={15} /> Animate</button>
            <button onClick={() => setModal("quiz")}><CircleHelp size={15} /> Quiz</button>
            <button onClick={() => setCompare(!compare)} className={compare ? "active" : ""}><Share2 size={15} /> Compare</button>
            <button
              className={`action-save ${saved ? "active" : ""}`}
              aria-pressed={saved}
              onClick={() => void toggleFavorite(organId)}
            ><Bookmark size={15} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save"}</button>
          </div>
        </aside>
      </div>

      {compare && view === "explore" && (
        <section className="compare-strip" aria-label="Organ comparison">
          <div className="compare-organ"><OrganArt organ={organ} asset="thumb" alt="" /><span>Comparing</span><strong>{organ.name}</strong><small>{organ.system}</small></div>
          <b>vs.</b>
          <div className="compare-organ"><OrganArt organ={reference} asset="thumb" alt="" /><span>Reference</span><strong>{reference.name}</strong><small>{reference.system}</small></div>
          <dl><div><dt>Primary role</dt><dd>{organ.function}</dd></div><div><dt>Scale</dt><dd>{organ.size}</dd></div></dl>
          <button onClick={() => setCompare(false)} aria-label="Close comparison"><X size={16} /></button>
        </section>
      )}

      <section className="learning-cards" hidden={view !== "explore"} aria-label={`${organ.name} learning resources`}>
        <article className="curiosity-card">
          <span>✿</span><p>Learning is<br />an act of curiosity.</p><em>Keep exploring!</em>
        </article>
        <article>
          <header><div><em>Microscopic view</em><h3>{organ.tissue}</h3></div><Microscope size={17} /></header>
          <div className="microscope-visual organ-card-image"><OrganArt organ={organ} asset="microscopic" alt={`${organ.name} microscopic tissue view`} /></div>
          <button onClick={() => setModal("lesson")}>Explore tissue <ArrowRight size={14} /></button>
        </article>
        <article>
          <header><div><em>Compare organs</em><h3>{organ.comparison}</h3></div><Share2 size={17} /></header>
          <div className="comparison-visual organ-card-image"><OrganArt organ={organ} asset="compare" alt={`${organ.comparison} anatomical comparison`} /></div>
          <button onClick={() => setCompare(true)}>Open comparison <ArrowRight size={14} /></button>
        </article>
        <article>
          <header><div><em>Function animation</em><h3>{organ.function}</h3></div><Play size={17} /></header>
          {/* The artwork itself is the control, so the play badge inside it is
              decorative rather than a nested button. */}
          <button
            type="button"
            className="function-visual organ-card-image"
            onClick={() => setModal("animation")}
            aria-label={`Play the ${organ.name.toLowerCase()} function animation`}
          >
            <OrganArt organ={organ} asset="organ" alt="" />
            <i className="function-pulse" />
            <span className="play-badge"><Play size={18} fill="currentColor" /></span>
          </button>
          <button onClick={() => setModal("animation")}>Play animation <ArrowRight size={14} /></button>
        </article>
        <article>
          <header><div><em>Clinical notes</em><h3>Common conditions</h3></div><FileText size={17} /></header>
          {/* The card keeps its slot rather than vanishing — a hole in the grid
              would read as a bug, and the note explains where they went. */}
          {conditionsHidden ? (
            <p className="conditions-hidden">
              Hidden while a child reading level is on. A grown-up can show these in settings.
            </p>
          ) : (
            <ul>{organ.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
          )}
          <button onClick={() => setModal("lesson")}>See all <ArrowRight size={14} /></button>
        </article>
        <article className="system-card">
          <header><div><em>Where it works</em><h3>{organ.system}</h3></div><BrainCircuit size={17} /></header>
          <button
            type="button"
            className="system-visual organ-card-image"
            onClick={() => setModal("system")}
            aria-label={`See where the ${organ.name.toLowerCase()} sits in the body`}
          >
            <OrganArt organ={organ} asset="location" alt="" />
          </button>
          <button onClick={() => setModal("system")}>See the system <ArrowRight size={14} /></button>
        </article>
      </section>

      {view === "systems" && (
        <SystemsIndex
          systems={systems}
          activeOrganId={organId}
          onSelectOrgan={openOrganFromIndex}
          onPrefetchOrgan={prefetchOrgan}
          onFilterSystem={filterBySystem}
        />
      )}

      {view === "library" && (
        <LibraryIndex
          entries={libraryEntries}
          onSelectOrgan={openOrganFromIndex}
          onPrefetchOrgan={prefetchOrgan}
        />
      )}

      {view === "notes" && (
        <NotesView currentOrganId={organId} onSelectOrgan={openOrganFromIndex} />
      )}

      {/* Re-checks the setting on render, so revoking permission mid-conversation
          closes the panel rather than leaving it live. */}
      {asking && parentSettings.askEnabled && view === "explore" && (
        <AskPanel
          organ={organ}
          hotspotId={asking.hotspotId}
          level={level}
          allowTyping={parentSettings.freeTypingEnabled}
          unlabelled={asking.unlabelled}
          image={asking.image}
          onClose={() => setAsking(null)}
        />
      )}

      {grownUpOpen && <GrownUpSettings onClose={() => setGrownUpOpen(false)} />}
      {modal && <LearningModal type={modal} organ={organ} level={level} onClose={() => setModal(null)} />}
      {mobileLibrary && <button className="drawer-backdrop" aria-label="Close library" onClick={() => setMobileLibrary(false)} />}
    </main>
  );
}

const MODAL_ICON: Record<Exclude<Modal, null>, string> = {
  quiz: "?",
  animation: "▶",
  system: "⌖",
  lesson: "✦",
};

function LearningModal({
  type,
  organ,
  level,
  onClose,
}: {
  type: Exclude<Modal, null>;
  organ: Organ;
  level: ReadingLevel;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);

  // `aria-modal` alone doesn't stop the browser tabbing behind the dialog, and
  // Escape did nothing. Trap focus inside, restore it to whatever opened the
  // dialog, and close on Escape.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("button, [href], input, select, textarea")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )].filter((node) => node.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, [onClose]);

  const organName = organ.name;
  const title =
    type === "quiz" ? `${organName} quick quiz`
    : type === "animation" ? `${organName} in motion`
    // Avoids gluing onto `system`, whose wording varies per organ
    // ("Cardiovascular" vs "Nervous System"), and stays grammatical for the
    // plural organs too.
    : type === "system" ? `${organName} in the body`
    : `Inside the ${organName.toLowerCase()}`;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className={`learning-modal ${type === "system" ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <span className="modal-icon">{MODAL_ICON[type]}</span>
        <em>Guided discovery</em>
        <h2 id="modal-title">{title}</h2>
        {type === "quiz" ? (
          <QuizPanel organ={organ} level={level} onClose={onClose} />
        ) : type === "system" ? (
          <>
            <p>{organ.location}. Trace how the {organName.toLowerCase()} connects to the rest of the body.</p>
            {/* Shown whole rather than cropped into the circular demo — the
                point of this view is the figure and its vessels. */}
            <figure className="modal-figure">
              <OrganArt organ={organ} asset="location" alt={`${organName} shown in place within the ${organ.system.toLowerCase()}`} />
            </figure>
            <dl className="modal-facts">
              <div><dt>System</dt><dd>{organ.system}</dd></div>
              <div><dt>Primary role</dt><dd>{organ.function}</dd></div>
              <div><dt>Blood supply</dt><dd>{organ.bloodSupply}</dd></div>
            </dl>
            <button className="lesson-button" onClick={onClose}>Continue exploring <ArrowRight size={16} /></button>
          </>
        ) : (
          <>
            <p>Follow the highlighted structures, rotate the specimen, and connect form with function. This short study moment is designed to build a durable mental model.</p>
            <div className={`modal-demo ${type === "animation" ? "moving" : ""}`}><OrganArt organ={organ} asset="organ" alt={`${organName} illustration`} /></div>
            <button className="lesson-button" onClick={onClose}>Continue exploring <ArrowRight size={16} /></button>
          </>
        )}
      </section>
    </div>
  );
}

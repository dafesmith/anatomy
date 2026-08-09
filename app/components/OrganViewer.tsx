"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  CircleDashed,
  Layers3,
  Maximize2,
  RotateCcw,
  ScanLine,
  Search,
  Sparkles,
  Square,
  Tag,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { Hotspot, Organ } from "../lib/anatomy-data";
import { hotspotReading, type ReadingLevel } from "../lib/kid-readings";
import { useSpeech } from "../lib/use-speech";
import { organMotion } from "../lib/organ-motion";
import { OrganSound, useOrganSound } from "../lib/organ-sound";
import {
  isOwnLabelId,
  LABEL_COLOURS,
  MAX_LABEL_LENGTH,
  ownLabelsAsHotspots,
  useOwnLabels,
} from "../lib/labels-store";
import type { AnatomyViewer } from "../lib/three/viewer";

type Props = {
  organ: Organ;
  autoRotate: boolean;
  onAutoRotate: (enabled: boolean) => void;
  compare: boolean;
  onCompare: () => void;
  level: ReadingLevel;
  /** Off unless a grown-up allowed it, so no asking affordance appears at all. */
  askEnabled: boolean;
  /**
   * True while a full-screen overlay is covering this viewer.
   *
   * `IntersectionObserver` cannot see occlusion, so without this the model keeps
   * rendering at full rate behind a modal — and the lesson mounts a second viewer
   * on top, leaving two contexts drawing at once on a tablet for no benefit.
   */
  covered?: boolean;
  onAsk: (start: { hotspotId?: string; unlabelled?: boolean; image?: string }) => void;
};

export function OrganViewer({
  organ,
  autoRotate,
  onAutoRotate,
  compare,
  onCompare,
  level,
  askEnabled,
  covered = false,
  onAsk,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AnatomyViewer | null>(null);
  const organRef = useRef(organ);
  const autoRotateRef = useRef(autoRotate);
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [slowLoad, setSlowLoad] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  /** Where a tap landed that hit no label — the prompt for "what's this bit?". */
  const [bareTap, setBareTap] = useState<{ x: number; y: number; at: [number, number, number] | null } | null>(null);
  /** Open composer for a label the child is writing, anchored at their tap. */
  const [naming, setNaming] = useState<{ x: number; y: number; at: [number, number, number] } | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [labelColour, setLabelColour] = useState(LABEL_COLOURS[0]);
  const askEnabledRef = useRef(askEnabled);
  const soundRef = useRef<OrganSound | null>(null);
  const { enabled: soundOn, toggle: toggleSound } = useOrganSound();
  const { labels: ownLabels, add: addLabel, remove: removeLabel } = useOwnLabels();
  const soundOnRef = useRef(soundOn);
  const organKindRef = useRef(organMotion(organ.id).kind);
  const { supported: canSpeak, speakingId, speak, stop: stopSpeaking } = useSpeech(level);
  // The atlas's dots and the child's own, as one list. Handing them to the viewer
  // together is what makes a label fade when it rotates away, be tappable, and open
  // a callout — all on the path that already existed.
  const allHotspots = useMemo(
    () => [...organ.hotspots, ...ownLabelsAsHotspots(ownLabels, organ.id)],
    [organ, ownLabels],
  );
  const hotspotsRef = useRef(allHotspots);

  const selectedIsOwn = selected ? isOwnLabelId(selected.id) : false;
  // A child's own label has no anatomical wording to sit beneath it.
  const kidLine = selected && !selectedIsOwn ? hotspotReading(organ.id, selected.id, level) : null;
  // Keyed per hotspot so re-opening a different dot doesn't inherit the previous
  // dot's speaking state.
  const calloutSpeechId = selected ? `callout:${organ.id}:${selected.id}` : "callout";

  // What this organ actually sounds like, so the button says something concrete
  // rather than just "Sound".
  const soundLabel = organMotion(organ.id).label;

  // A typical organ is ready well inside a second — flashing a loading panel for
  // that reads as jank. It only appears if the fetch is genuinely slow; the flag
  // is cleared by onLoading when the next load starts.
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setSlowLoad(true), 900);
    return () => window.clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    organRef.current = organ;
    organKindRef.current = organMotion(organ.id).kind;
  }, [organ]);

  useEffect(() => {
    hotspotsRef.current = allHotspots;
  }, [allHotspots]);

  useEffect(() => {
    soundOnRef.current = soundOn;
    // Switching off should stop what is already ringing, not just skip the next
    // cue — the tail of a breath is over a second long.
    soundRef.current?.mute(!soundOn);
  }, [soundOn]);

  // Silenced while a modal covers the viewer, matching the render loop. A
  // heartbeat still thumping under a settings panel sounds like a bug.
  useEffect(() => {
    if (covered) soundRef.current?.mute(true);
    else if (soundOn) soundRef.current?.mute(false);
  }, [covered, soundOn]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // The viewer is constructed once, so its callback reads this ref rather than
  // closing over a stale `askEnabled` from the first render. Nothing needs
  // clearing when permission is revoked — the render already gates on it.
  useEffect(() => {
    askEnabledRef.current = askEnabled;
  }, [askEnabled]);

  useEffect(() => {
    let cancelled = false;
    let viewer: AnatomyViewer | null = null;

    void import("../lib/three/viewer").then(({ AnatomyViewer: Viewer }) => {
      if (cancelled || !mountRef.current) return;
      viewer = new Viewer(mountRef.current, {
        onSelect: (hotspot) => {
          setSelected(hotspot);
          // Opening a label answers the question, so the bare-tap prompt goes.
          if (hotspot) setBareTap(null);
        },
        onLoading: (isLoading, value) => {
          setLoading(isLoading);
          setProgress(value);
          if (isLoading) setSlowLoad(false);
        },
        onUnlabelledTap: (point) => {
          // Offered whether or not the AI is on: writing your own label is not an
          // AI feature, and asking was off by default, so this prompt never
          // appeared for most people. Gated on `at` instead — a tap that sailed
          // past the organ into the background has nothing to label, and ringing
          // empty paper for the model to look at was never useful either.
          if (point.at) setBareTap(point);
        },
        onBeat: (strength) => {
          if (!soundOnRef.current) return;
          // Built on first use, which is always inside the gesture that switched
          // sound on — so the browser's autoplay policy is satisfied by the same
          // tap that asked for it.
          soundRef.current ??= new OrganSound();
          soundRef.current.play(organKindRef.current, strength);
        },
      });
      viewerRef.current = viewer;
      // Local-only handle, alongside the existing /__debug surface. `capture()` is
      // otherwise unreachable from outside this component, which makes the one
      // thing worth checking by hand — that a still comes out non-blank — hard to
      // check. A hostname test rather than a build flag, because `types` is pinned
      // to workers-types and `import.meta.env` isn't typed here.
      if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
        (window as unknown as { __anatomyViewer?: AnatomyViewer }).__anatomyViewer = viewer;
      }
      viewer.setAutoRotate(autoRotateRef.current);
      const current = organRef.current;
      viewer.setOrgan(current.model, hotspotsRef.current, current.accent, organMotion(current.id)).catch(() => {
        setLoading(false);
        setProgress(0);
      });
    });

    return () => {
      cancelled = true;
      viewerRef.current = null;
      viewer?.dispose();
      soundRef.current?.dispose();
      soundRef.current = null;
    };
  }, []);

  useEffect(() => {
    viewerRef.current?.setOrgan(organ.model, hotspotsRef.current, organ.accent, organMotion(organ.id)).catch(() => {
      setLoading(false);
      setProgress(0);
    });
    // Keyed on the organ alone on purpose: adding a label must not reload the
    // model, which is what `setHotspots` below is for.
  }, [organ]);

  // Adding or deleting a label re-attaches the dots in place. Going through
  // `setOrgan` instead would replay the organ's entrance animation every time a
  // child named something.
  //
  // Skipped on the render where the organ itself changed, because `setOrgan` above
  // is already loading and this would otherwise hang the *new* organ's labels on
  // the *old* organ's mesh for as long as that load takes.
  const attachedFor = useRef(organ.id);
  useEffect(() => {
    if (attachedFor.current !== organ.id) {
      attachedFor.current = organ.id;
      return;
    }
    viewerRef.current?.setHotspots(allHotspots);
  }, [allHotspots, organ.id]);

  // Switching organ drops the open callout, so its voice — and the Stop icon on
  // its button — have to go with it.
  useEffect(() => stopSpeaking, [organ, stopSpeaking]);

  useEffect(() => viewerRef.current?.setAutoRotate(autoRotate), [autoRotate]);
  useEffect(() => viewerRef.current?.setPaused(covered), [covered]);

  // The viewer drives the callout's position directly, so a spinning model
  // never costs a React render.
  const calloutRef = useCallback((node: HTMLDivElement | null) => {
    viewerRef.current?.attachCallout(node);
  }, []);

  const handleTool = (tool: string) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (tool === "rotate") onAutoRotate(!autoRotate);
    if (tool === "zoom") viewer.zoom(-1);
    if (tool === "isolate") setActiveTool(viewer.toggleIsolate() ? tool : null);
    if (tool === "section") setActiveTool(viewer.toggleCrossSection() ? tool : null);
    if (tool === "layers") setActiveTool(viewer.toggleLayers() ? tool : null);
    if (tool === "compare") onCompare();
    if (tool === "reset") {
      viewer.reset();
      setActiveTool(null);
    }
  };

  const tools = [
    { id: "rotate", label: "Rotate", icon: RotateCcw },
    { id: "zoom", label: "Zoom", icon: Search },
    { id: "isolate", label: "Isolate", icon: CircleDashed },
    { id: "section", label: "Cross-section", icon: ScanLine },
    { id: "layers", label: "Layers", icon: Layers3 },
    { id: "compare", label: "Compare", icon: Box },
    { id: "reset", label: "Reset", icon: RotateCcw },
  ];

  return (
    <section className="viewer-shell" aria-label={`${organ.name} interactive viewer`}>
      <div className="viewer-glow" style={{ "--organ-accent": organ.accent } as React.CSSProperties} />
      <div ref={mountRef} className="three-mount" />

      <div className="viewer-tools" aria-label="3D viewer tools">
        {tools.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`tool-button ${(activeTool === id || (id === "compare" && compare)) ? "active" : ""}`}
            onClick={() => handleTool(id)}
            aria-pressed={activeTool === id || (id === "compare" && compare)}
            title={label}
          >
            <Icon size={19} strokeWidth={1.65} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <aside className="tip-note" aria-label="Viewer instructions">
        <span><Sparkles size={15} /> Tip</span>
        <p>Drag to rotate<br />Scroll to zoom<br />Click a dot to learn more</p>
      </aside>

      {selected && (
        <div className="hotspot-callout" ref={calloutRef} data-side="right">
          <div className="callout-body" style={{ "--hotspot-color": selected.color } as React.CSSProperties}>
            <button className="callout-close" type="button" onClick={() => viewerRef.current?.clearSelection()} aria-label="Close">
              <X size={13} />
            </button>
            <b>{selected.label}</b>
            {/* The kid line leads and the anatomical one stays beneath it, so the
                child reads plain words while a parent alongside still sees the
                real wording — no toggling, no taking the screen off one of them. */}
            {kidLine ? (
              <>
                <small className="callout-kid">{kidLine}</small>
                <small className="callout-term">{selected.detail}</small>
              </>
            ) : (
              <small>{selected.detail}</small>
            )}
            {canSpeak && (
              <button
                type="button"
                className="callout-speak"
                // "Read about the aorta aloud" works; "Read about the my blood goes
                // here aloud" does not. A child's label is a phrase they wrote, not
                // the name of a part, so it does not take an article.
                aria-label={
                  speakingId === calloutSpeechId
                    ? "Stop reading"
                    : selectedIsOwn
                      ? "Read your label aloud"
                      : `Read about the ${selected.label.toLowerCase()} aloud`
                }
                onClick={() => speak(calloutSpeechId, `${selected.label}. ${kidLine ?? selected.detail}`)}
              >
                {speakingId === calloutSpeechId ? <Square size={13} /> : <Volume2 size={13} />}
              </button>
            )}
            {/* "Tell me more" would send a child's own label to the model, which has
                never heard of it and would only be able to say so. Their labels get
                a delete instead — the one thing they might actually want. */}
            {selectedIsOwn ? (
              <button
                type="button"
                className="callout-delete"
                onClick={() => {
                  viewerRef.current?.clearSelection();
                  void removeLabel(selected.id);
                }}
              >
                <Trash2 size={13} /> Remove my label
              </button>
            ) : (
              askEnabled && (
                <button
                  type="button"
                  className="callout-ask"
                  onClick={() => onAsk({ hotspotId: selected.id })}
                >
                  Tell me more
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* A tap that landed on the organ but on no label. Two things it can become:
          a question for the model, or a label of the child's own. The capture for
          the question is taken here, at the moment of the tap, because by the time
          it is sent the organ may have rotated and the ring would point at the
          wrong thing. */}
      {bareTap && !selected && !naming && (
        <div className="bare-tap" style={{ left: bareTap.x, top: bareTap.y }}>
          {askEnabled && (
            <button
              type="button"
              onClick={() => {
                onAsk({
                  unlabelled: true,
                  image: viewerRef.current?.capture({ mark: bareTap }) ?? undefined,
                });
                setBareTap(null);
              }}
            >
              What&rsquo;s this bit?
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              // `at` is non-null for any tap that reaches here — see onUnlabelledTap.
              if (bareTap.at) setNaming({ x: bareTap.x, y: bareTap.y, at: bareTap.at });
              setLabelDraft("");
              setBareTap(null);
            }}
          >
            <Tag size={13} /> Name it yourself
          </button>
        </div>
      )}

      {naming && (
        <form
          className="label-composer"
          style={{ left: naming.x, top: naming.y }}
          onSubmit={(event) => {
            event.preventDefault();
            const text = labelDraft.trim();
            if (!text) return;
            void addLabel({ organId: organ.id, label: text, position: naming.at, color: labelColour });
            setNaming(null);
            setLabelDraft("");
          }}
        >
          <input
            value={labelDraft}
            onChange={(event) => setLabelDraft(event.target.value)}
            maxLength={MAX_LABEL_LENGTH}
            placeholder="What is this bit?"
            aria-label="Your label for this part"
            autoFocus
          />
          <div className="label-colours" role="group" aria-label="Label colour">
            {LABEL_COLOURS.map((colour) => (
              <button
                key={colour}
                type="button"
                className={colour === labelColour ? "chosen" : ""}
                style={{ background: colour }}
                aria-label={`Use this colour`}
                aria-pressed={colour === labelColour}
                onClick={() => setLabelColour(colour)}
              />
            ))}
          </div>
          <div className="label-actions">
            <button type="button" onClick={() => setNaming(null)}>Cancel</button>
            <button type="submit" disabled={!labelDraft.trim()}>Add</button>
          </div>
        </form>
      )}

      {/* Screen-reader equivalent of the dots, which live in the canvas. The
          child's own labels are in here too — they are dots on the model exactly
          like the atlas's, so leaving them out would hide them from the only
          reading of this viewer that is not visual. */}
      <ul className="hotspot-index">
        {allHotspots.map((hotspot) => (
          <li key={hotspot.id}>{hotspot.label}: {hotspot.detail}</li>
        ))}
      </ul>

      {loading && slowLoad && (
        <div className="model-loader" role="status" aria-live="polite">
          <div className="loader-orbit"><Maximize2 size={20} /></div>
          <strong>Preparing the {organ.name.toLowerCase()}</strong>
          <span>{Math.max(8, Math.round(progress * 100))}%</span>
        </div>
      )}

      {/* Named for what it actually plays, per organ — "Sound" gives a child no
          idea there is a heartbeat behind it. Off until pressed: audio that starts
          on its own is unwelcome on a shared tablet, and browsers block it anyway. */}
      <button
        className="organ-sound"
        type="button"
        onClick={toggleSound}
        aria-pressed={soundOn}
        title={soundOn ? "Turn the sound off" : `Hear the ${organ.name.toLowerCase()}`}
      >
        {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
        <span>{soundLabel}</span>
      </button>

      <button className="auto-rotate" type="button" onClick={() => onAutoRotate(!autoRotate)} aria-pressed={autoRotate}>
        <RotateCcw size={14} /> Auto rotate
        <span className={`switch ${autoRotate ? "on" : ""}`}><i /></span>
      </button>

      <div className="view-caption">
        {/* "Specimen" belonged to the old name and the old audience — it is a word
            for something in a jar, not for the thing beating in front of a child.
            The scientific name stays underneath, where a parent can still see it. */}
        <span>Turn it around · tap a dot to find out more</span>
        <strong>{organ.scientificName}</strong>
      </div>
    </section>
  );
}

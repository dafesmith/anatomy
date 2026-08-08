"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Volume2,
  X,
} from "lucide-react";
import type { Hotspot, Organ } from "../lib/anatomy-data";
import { hotspotReading, type ReadingLevel } from "../lib/kid-readings";
import { useSpeech } from "../lib/use-speech";
import type { AnatomyViewer } from "../lib/three/viewer";

type Props = {
  organ: Organ;
  autoRotate: boolean;
  onAutoRotate: (enabled: boolean) => void;
  compare: boolean;
  onCompare: () => void;
  level: ReadingLevel;
};

export function OrganViewer({ organ, autoRotate, onAutoRotate, compare, onCompare, level }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AnatomyViewer | null>(null);
  const organRef = useRef(organ);
  const autoRotateRef = useRef(autoRotate);
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [slowLoad, setSlowLoad] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const { supported: canSpeak, speakingId, speak, stop: stopSpeaking } = useSpeech(level);
  const kidLine = selected ? hotspotReading(organ.id, selected.id, level) : null;
  // Keyed per hotspot so re-opening a different dot doesn't inherit the previous
  // dot's speaking state.
  const calloutSpeechId = selected ? `callout:${organ.id}:${selected.id}` : "callout";

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
  }, [organ]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    let cancelled = false;
    let viewer: AnatomyViewer | null = null;

    void import("../lib/three/viewer").then(({ AnatomyViewer: Viewer }) => {
      if (cancelled || !mountRef.current) return;
      viewer = new Viewer(mountRef.current, {
        onSelect: setSelected,
        onLoading: (isLoading, value) => {
          setLoading(isLoading);
          setProgress(value);
          if (isLoading) setSlowLoad(false);
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
      viewer.setOrgan(current.model, current.hotspots, current.accent).catch(() => {
        setLoading(false);
        setProgress(0);
      });
    });

    return () => {
      cancelled = true;
      viewerRef.current = null;
      viewer?.dispose();
    };
  }, []);

  useEffect(() => {
    viewerRef.current?.setOrgan(organ.model, organ.hotspots, organ.accent).catch(() => {
      setLoading(false);
      setProgress(0);
    });
  }, [organ]);

  // Switching organ drops the open callout, so its voice — and the Stop icon on
  // its button — have to go with it.
  useEffect(() => stopSpeaking, [organ, stopSpeaking]);

  useEffect(() => viewerRef.current?.setAutoRotate(autoRotate), [autoRotate]);

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
                aria-label={speakingId === calloutSpeechId ? "Stop reading" : `Read about the ${selected.label.toLowerCase()} aloud`}
                onClick={() => speak(calloutSpeechId, `${selected.label}. ${kidLine ?? selected.detail}`)}
              >
                {speakingId === calloutSpeechId ? <Square size={13} /> : <Volume2 size={13} />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Screen-reader equivalent of the dots, which live in the canvas. */}
      <ul className="hotspot-index">
        {organ.hotspots.map((hotspot) => (
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

      <button className="auto-rotate" type="button" onClick={() => onAutoRotate(!autoRotate)} aria-pressed={autoRotate}>
        <RotateCcw size={14} /> Auto rotate
        <span className={`switch ${autoRotate ? "on" : ""}`}><i /></span>
      </button>

      <div className="view-caption">
        <span>3D specimen · click a dot to explore</span>
        <strong>{organ.scientificName}</strong>
      </div>
    </section>
  );
}

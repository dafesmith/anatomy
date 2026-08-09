"use client";

import { useEffect, useRef, useState } from "react";
import type { Organ } from "../lib/anatomy-data";
import { organMotion } from "../lib/organ-motion";
import type { AnatomyViewer } from "../lib/three/viewer";

type Props = {
  organ: Organ;
  /** The labelled part this beat is about, swung to face the reader. */
  hotspotId?: string;
  /**
   * False on the illustrated beats, where this stage is still mounted but covered.
   * It stops drawing rather than rendering an invisible frame — the context and the
   * loaded model stay warm either way.
   */
  active: boolean;
};

/**
 * The live model, inside a lesson.
 *
 * A second viewer rather than a reach into the one behind the modal: that one is
 * a different size, framed differently, and carries a toolbar and a callout the
 * lesson does not want. Two WebGL contexts is well inside every browser's limit,
 * and `LearningModal` pauses the background viewer while this one is up so only
 * one is ever drawing — see `AnatomyViewer.setPaused`.
 *
 * Drag and zoom are left on. A child turning the model over themselves is the
 * point of the app, and a lesson beat is a good moment to invite it.
 */
export function LessonStage({ organ, hotspotId, active }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AnatomyViewer | null>(null);
  const organRef = useRef(organ);
  const hotspotRef = useRef(hotspotId);
  const [loading, setLoading] = useState(true);

  // Mirrored into refs in an effect rather than during render — writing a ref while
  // rendering is unsafe under concurrent rendering. The mount effect below reads
  // these after the model resolves, which can be several beats later than the tap
  // that started the load, so it needs the *current* part rather than the one that
  // was showing when the load began.
  useEffect(() => {
    organRef.current = organ;
    hotspotRef.current = hotspotId;
  }, [organ, hotspotId]);

  useEffect(() => {
    let cancelled = false;
    let viewer: AnatomyViewer | null = null;

    void import("../lib/three/viewer").then(({ AnatomyViewer: Viewer }) => {
      if (cancelled || !mountRef.current) return;
      viewer = new Viewer(mountRef.current, {
        // The lesson supplies its own words, so the viewer's callout stays shut and
        // nothing here needs the selection reported back.
        onSelect: () => {},
        onLoading: (isLoading) => setLoading(isLoading),
      });
      viewerRef.current = viewer;
      const current = organRef.current;
      viewer
        .setOrgan(current.model, current.hotspots, current.accent, organMotion(current.id))
        .then(() => {
          if (cancelled) return;
          // Applied after the model exists, because the dot has no position until
          // the hotspot layer is attached.
          if (hotspotRef.current) viewer?.focusHotspot(hotspotRef.current);
        })
        .catch(() => setLoading(false));
    });

    return () => {
      cancelled = true;
      viewerRef.current = null;
      viewer?.dispose();
    };
  }, []);

  // Stepping between beats swings the model to the part being described, and
  // releases it — resuming auto-rotate — on the beats that are about the whole
  // organ.
  useEffect(() => {
    viewerRef.current?.focusHotspot(hotspotId ?? null);
  }, [hotspotId]);

  useEffect(() => {
    viewerRef.current?.setPaused(!active);
  }, [active]);

  return (
    // `hidden` would collapse the canvas to nothing and make the ResizeObserver
    // re-fit it on every return; staying laid out and merely invisible avoids that.
    <div className="lesson-stage" data-active={active} aria-hidden={!active}>
      <div ref={mountRef} className="lesson-stage-canvas" />
      {loading && active && <span className="lesson-stage-loading">Loading the model…</span>}
    </div>
  );
}

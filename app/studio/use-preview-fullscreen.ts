"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Keep the same preview mounted so entering full screen preserves its state. */
export function usePreviewFullscreen() {
  const previewRef = useRef<HTMLElement>(null);
  const usedNativeFullscreen = useRef(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    function changed() {
      if (usedNativeFullscreen.current && !document.fullscreenElement) {
        usedNativeFullscreen.current = false;
        setExpanded(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setExpanded(false);
      if (document.fullscreenElement === previewRef.current)
        void document.exitFullscreen().catch(() => {});
    }
    document.addEventListener("fullscreenchange", changed);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const toggle = useCallback(async () => {
    const preview = previewRef.current;
    if (!preview) return;
    if (expanded) {
      setExpanded(false);
      if (document.fullscreenElement === preview)
        await document.exitFullscreen().catch(() => {});
      return;
    }
    setExpanded(true);
    // Embedded browsers may decline native full screen. The expanded preview
    // still fills the app window in that case.
    if (typeof preview.requestFullscreen === "function") {
      try {
        await preview.requestFullscreen();
        usedNativeFullscreen.current = true;
      } catch {
        usedNativeFullscreen.current = false;
      }
    }
  }, [expanded]);

  return { previewRef, expanded, toggle };
}

"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

// Theme changes reset the interface session. Retain only the selected label so
// its indicator can continue across that reset; no workspace content is stored.
const previousSelection = new Map<string, string>();

export function SmoothTabs({ className, label, children }: {
  className: string; label: string; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const group = root.current;
    const pill = indicator.current;
    if (!group || !pill) return;
    let last: { x: number; width: number } | null = null;
    let animation: Animation | undefined;
    const update = () => {
      if (!group.getClientRects().length) return;
      const buttons = [...group.querySelectorAll<HTMLButtonElement>("button")];
      const active = buttons.find(button => button.getAttribute("aria-pressed") === "true");
      if (!active) return;
      const name = active.textContent?.trim() ?? "";
      const previous = label === "Theme" ? previousSelection.get(label) : undefined;
      const oldButton = previous && buttons.find(button => button.textContent?.trim() === previous);
      const from = last ?? (oldButton ? { x: oldButton.offsetLeft, width: oldButton.offsetWidth } : null);
      const next = { x: active.offsetLeft, width: active.offsetWidth };
      if (last?.x === next.x && last.width === next.width) return;
      animation?.cancel();
      pill.style.width = `${next.width}px`;
      pill.style.transform = `translateX(${next.x}px)`;
      pill.style.opacity = "1";
      if (from && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        animation = pill.animate([
          { transform: `translateX(${from.x}px) scaleX(${from.width / next.width})` },
          { transform: `translateX(${next.x}px) scaleX(1)` },
        ], { duration: 260, easing: "cubic-bezier(.22,1,.36,1)" });
      }
      last = next;
      if (label === "Theme") previousSelection.set(label, name);
    };
    update();
    const resize = new ResizeObserver(update);
    resize.observe(group);
    const mutation = new MutationObserver(update);
    mutation.observe(group, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    return () => { resize.disconnect(); mutation.disconnect(); animation?.cancel(); };
  }, [label]);
  return <div ref={root} className={`${className} studio-smooth-tabs`} role="group" aria-label={label}>
    <span ref={indicator} className="studio-tab-indicator" aria-hidden="true" />
    {children}
  </div>;
}

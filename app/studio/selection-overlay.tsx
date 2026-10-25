"use client";
import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent,
} from "react";
import type { SelectionInfo } from "../lib/openui/refinement/scope";

type Props = {
  root: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  busy: boolean;
  index: Record<string, SelectionInfo>;
  selected: string | null;
  onSelect: (id: string | null) => void;
};
export function SelectionOverlay({
  root,
  enabled,
  busy,
  index,
  selected,
  onSelect,
}: Props) {
  const [hover, setHover] = useState<string | null>(null),
    [boxes, setBoxes] = useState<
      Record<
        string,
        { left: number; top: number; width: number; height: number }
      >
    >({});
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !root.current) return;
    const element = root.current;
    const resolve = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      const compound = target.closest(
        '[data-ii-component="Table"], [data-ii-component="Chart"], [data-ii-component="DataList"], [data-ii-component="MetricCards"], [data-ii-component$="Chart"], [data-ii-component$="ChartCondensed"]',
      );
      const hit = compound ?? target.closest("[data-ii-selection]");
      if (!hit || !element.contains(hit)) return null;
      const key = hit.getAttribute("data-ii-selection");
      return key && index[key] ? key : null;
    };
    const move = (event: globalThis.PointerEvent) =>
      setHover(resolve(event.target));
    const leave = () => setHover(null);
    const click = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!busy) onSelect(resolve(event.target));
    };
    const block = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Tab") return;
      if (event.key === "Escape") {
        event.preventDefault();
        onSelect(null);
      } else if ((event.key === "Enter" || event.key === " ") && !busy) {
        block(event);
        onSelect(resolve(event.target));
      } else block(event);
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("click", click, true);
    element.addEventListener("pointerdown", block, true);
    element.addEventListener("keydown", key, true);
    element.addEventListener("submit", block, true);
    element.addEventListener("focusin", block, true);
    element.addEventListener("beforeinput", block, true);
    element.addEventListener("contextmenu", block, true);
    return () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("click", click, true);
      element.removeEventListener("pointerdown", block, true);
      element.removeEventListener("keydown", key, true);
      element.removeEventListener("submit", block, true);
      element.removeEventListener("focusin", block, true);
      element.removeEventListener("beforeinput", block, true);
      element.removeEventListener("contextmenu", block, true);
    };
  }, [root, enabled, busy, index, onSelect]);
  useEffect(() => {
    if (!enabled || !root.current) return;
    const element = root.current;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next: Record<
        string,
        { left: number; top: number; width: number; height: number }
      > = {};
      const anchor = layer.current?.getBoundingClientRect();
      if (!anchor) return;
      const viewport = element.parentElement!.getBoundingClientRect();
      for (const id of new Set(
        [selected, hover].filter((v): v is string => !!v),
      )) {
        const matches = [
          ...element.querySelectorAll<HTMLElement>("[data-ii-selection]"),
        ].filter(
          (el) => el.dataset.iiSelection === id && el.getClientRects().length,
        );
        const rects = matches.map((el) => el.getBoundingClientRect());
        if (!rects.length) continue;
        const left = Math.max(
            viewport.left,
            Math.min(...rects.map((r) => r.left)),
          ),
          top = Math.max(viewport.top, Math.min(...rects.map((r) => r.top))),
          right = Math.min(
            viewport.right,
            Math.max(...rects.map((r) => r.right)),
          ),
          bottom = Math.min(
            viewport.bottom,
            Math.max(...rects.map((r) => r.bottom)),
          );
        if (right <= left || bottom <= top) continue;
        next[id] = {
          left: left - anchor.left,
          top: top - anchor.top,
          width: right - left,
          height: bottom - top,
        };
      }
      setBoxes(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    const mo = new MutationObserver(schedule);
    mo.observe(element, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    schedule();
    return () => {
      observer.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      cancelAnimationFrame(frame);
    };
  }, [enabled, selected, hover, index, root]);
  function ignore(event: PointerEvent) {
    event.stopPropagation();
  }
  if (!enabled) return null;
  return (
    <div
      ref={layer}
      className="studio-selection-layer"
      aria-hidden="true"
      onPointerDown={ignore}
    >
      {Object.entries(boxes).map(([id, box]) => (
        <div
          key={id}
          className={`studio-selection-box ${id === selected ? "is-selected" : ""}`}
          style={box}
        >
          <span>{index[id]?.label ?? "Component"}</span>
        </div>
      ))}
    </div>
  );
}

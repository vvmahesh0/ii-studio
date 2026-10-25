import type { FlowSnapshot } from "./contract.ts";
export type EditHistory = {
  past: FlowSnapshot[];
  present: FlowSnapshot;
  future: FlowSnapshot[];
};
export function commit(h: EditHistory, next: FlowSnapshot): EditHistory {
  return JSON.stringify(h.present) === JSON.stringify(next)
    ? h
    : { past: [...h.past, h.present].slice(-40), present: next, future: [] };
}
export function undo(h: EditHistory): EditHistory {
  return h.past.length
    ? {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future].slice(0, 40),
      }
    : h;
}
export function redo(h: EditHistory): EditHistory {
  return h.future.length
    ? {
        past: [...h.past, h.present].slice(-40),
        present: h.future[0],
        future: h.future.slice(1),
      }
    : h;
}

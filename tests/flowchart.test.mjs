import test from "node:test";
import assert from "node:assert/strict";
import {
  diagramSchema,
  graphIssues,
  connectedPreview,
  topology,
  geometryKey,
} from "../app/lib/flowchart/contract.ts";
import {
  purchaseFixture,
  onboardingFixture,
} from "../app/lib/flowchart/examples.ts";
import { FlowRecordStream } from "../app/lib/flowchart/stream.ts";
import { commit, undo, redo } from "../app/lib/flowchart/history.ts";
function records(d) {
  return [
    JSON.stringify({
      type: "diagram",
      title: d.title,
      direction: d.direction,
      assumptions: d.assumptions,
    }),
    ...d.nodes.map((n) => JSON.stringify({ type: "node", ...n })),
    ...d.edges.map((e) => JSON.stringify({ type: "edge", ...e })),
    JSON.stringify({ type: "done" }),
  ].join("\n");
}
for (const [name, fixture] of Object.entries({
  purchase: purchaseFixture,
  onboarding: onboardingFixture,
})) {
  test(`${name}: valid schema, connected branches and loops with exits`, () => {
    assert.equal(diagramSchema.safeParse(fixture).success, true);
    assert.deepEqual(graphIssues(fixture), []);
  });
  test(`${name}: streaming parser accepts arbitrary chunk boundaries`, () => {
    const parser = new FlowRecordStream();
    const text = records(fixture);
    for (let i = 0; i < text.length; i += 7) parser.push(text.slice(i, i + 7));
    const result = parser.finish();
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.document, fixture);
  });
}
test("clarification is an alternative response, not a graph", () => {
  const p = new FlowRecordStream();
  p.push(
    '{"type":"clarification","question":"What approval threshold applies?","options":["No threshold","I will specify"]}',
  );
  const r = p.finish();
  assert.equal(r.document, null);
  assert.equal(r.clarification.options.length, 2);
  assert.deepEqual(r.errors, []);
});
test("mixed clarification and graph is rejected", () => {
  const p = new FlowRecordStream();
  p.push(
    '{"type":"clarification","question":"Which policy?"}\n' +
      records(purchaseFixture),
  );
  assert.ok(p.finish().errors.length);
});
test("malformed output, missing done, unknown settings are rejected", () => {
  for (const text of [
    "not JSON",
    records(purchaseFixture).replace('{"type":"done"}', ""),
    '{"type":"diagram","title":"X","direction":"DOWN","html":"bad"}\n',
  ]) {
    const p = new FlowRecordStream();
    p.push(text);
    assert.ok(p.finish().errors.length);
  }
});
test("duplicate IDs, endpoints and branch labels are rejected", () => {
  const d = structuredClone(purchaseFixture);
  d.nodes.push(d.nodes[0]);
  d.edges[0].target = "missing";
  d.edges.find((e) => e.source === "amount").label = "";
  assert.ok(graphIssues(d).length >= 3);
});
test("a disconnected component and a closed retry loop are rejected", () => {
  const d = structuredClone(purchaseFixture);
  d.edges = d.edges.filter((e) => e.target !== "done");
  d.nodes.push({ id: "orphan", kind: "process", label: "Disconnected" });
  assert.ok(graphIssues(d).some((s) => s.includes("unreachable")));
  assert.ok(graphIssues(d).some((s) => s.includes("no route")));
});
test("pending arrows do not enter provisional connected graph", () => {
  const d = structuredClone(purchaseFixture);
  d.nodes = d.nodes.slice(0, 3);
  d.edges.push({ id: "waiting", source: "submit", target: "future" });
  const p = connectedPreview(d);
  assert.ok(p);
  assert.equal(
    p.edges.some((e) => e.id === "waiting"),
    false,
  );
});
test("label edits preserve topology; structural changes do not", () => {
  const d = structuredClone(purchaseFixture);
  d.nodes[5].label = "Amount above ₹75,000?";
  assert.equal(topology(d), topology(purchaseFixture));
  d.edges.pop();
  assert.notEqual(topology(d), topology(purchaseFixture));
});
test("undo/redo is bounded and a committed edit clears redo", () => {
  const s = {
    document: purchaseFixture,
    positions: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  let h = { past: [], present: s, future: [] };
  for (let i = 0; i < 50; i++)
    h = commit(h, { ...s, document: { ...s.document, title: `Title ${i}` } });
  assert.equal(h.past.length, 40);
  const last = h.present;
  h = undo(h);
  assert.notDeepEqual(h.present, last);
  h = redo(h);
  assert.deepEqual(h.present, last);
  h = commit(undo(h), s);
  assert.deepEqual(h.future, []);
});
test("30 nodes supported, 31 rejected", () => {
  const d = {
    ...purchaseFixture,
    nodes: [
      ...purchaseFixture.nodes,
      ...Array.from({ length: 30 - purchaseFixture.nodes.length }, (_, i) => ({
        id: `note${i}`,
        kind: "note",
        label: "Context",
      })),
    ],
  };
  assert.equal(diagramSchema.safeParse(d).success, true);
  assert.deepEqual(graphIssues(d), []);
  d.nodes.push({ id: "overflow", kind: "note", label: "Too many" });
  assert.equal(diagramSchema.safeParse(d).success, false);
});

test("valid flow returns without a correction; invalid flow is corrected once", async () => {
  const { generateFlowWithCorrection } =
    await import("../app/lib/flowchart/generation.ts");
  let count = 0;
  const good = records(purchaseFixture);
  const r = await generateFlowWithCorrection("Request", async (_, delta) => {
    count++;
    delta(good);
    return good;
  });
  assert.equal(count, 1);
  assert.equal(r.corrections, 0);
  count = 0;
  const fixed = await generateFlowWithCorrection("Request", async () =>
    ++count === 1 ? "bad" : good,
  );
  assert.equal(count, 2);
  assert.equal(fixed.corrections, 1);
  count = 0;
  await assert.rejects(() =>
    generateFlowWithCorrection("Request", async () => {
      count++;
      return "bad";
    }),
  );
  assert.equal(count, 2);
  count = 0;
  await assert.rejects(() =>
    generateFlowWithCorrection("Request", async () => {
      count++;
      throw new Error("Connection closed");
    }),
  );
  assert.equal(count, 1);
});

test("ELK layouts handle loops, long labels, 30 steps and both directions without overlapping nodes", async () => {
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const { layoutGraph } = await import("../app/lib/flowchart/layout-graph.ts");
  const elk = new ELK();
  for (const direction of ["DOWN", "RIGHT"]) {
    const d = structuredClone(purchaseFixture);
    d.direction = direction;
    while (d.nodes.length < 30) {
      const id = `extra${d.nodes.length}`;
      d.nodes.push({
        id,
        kind: "note",
        label:
          "A long supporting note explaining why this step is important for the business review and the people using the process.",
      });
    }
    const result = await elk.layout(layoutGraph(d));
    assert.equal(result.children.length, 30);
    for (const [i, a] of result.children.entries()) {
      assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y));
      for (const b of result.children.slice(i + 1))
        assert.ok(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y,
        );
    }
  }
});

test("duplicate streamed IDs cannot become a provisional diagram", () => {
  let published = 0;
  const parser = new FlowRecordStream(() => published++);
  parser.push('{"type":"diagram","title":"Flow","direction":"DOWN"}\n');
  parser.push('{"type":"node","id":"a","kind":"start","label":"Begin"}\n');
  const before = published;
  parser.push(
    '{"type":"node","id":"a","kind":"process","label":"Duplicate"}\n',
  );
  assert.equal(published, before);
  assert.ok(parser.finish().errors.includes("Node IDs must be unique."));
});

test("a clarification completes in one turn without a correction", async () => {
  const { generateFlowWithCorrection } =
    await import("../app/lib/flowchart/generation.ts");
  let calls = 0;
  const result = await generateFlowWithCorrection(
    "Missing approval policy",
    async () => {
      calls++;
      return JSON.stringify({
        type: "clarification",
        question: "What amount requires approval?",
      });
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.corrections, 0);
  assert.equal(result.document, null);
  assert.ok(result.clarification);
});

test("deleting a node and incident edges can be undone without consuming a version", () => {
  const document = structuredClone(purchaseFixture);
  const s = { document, positions: {}, viewport: { x: 0, y: 0, zoom: 1 } };
  const id = document.nodes[2].id;
  const next = {
    ...s,
    document: {
      ...document,
      nodes: document.nodes.filter((n) => n.id !== id),
      edges: document.edges.filter((e) => e.source !== id && e.target !== id),
    },
  };
  const history = commit({ past: [], present: s, future: [] }, next);
  assert.ok(
    history.present.document.edges.every(
      (e) => e.source !== id && e.target !== id,
    ),
  );
  assert.deepEqual(undo(history).present, s);
});

test("ELK arrow routes and branch labels avoid unrelated nodes", async () => {
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const { layoutGraph } = await import("../app/lib/flowchart/layout-graph.ts");
  const elk = new ELK();
  for (const fixture of [purchaseFixture, onboardingFixture])
    for (const direction of ["DOWN", "RIGHT"]) {
      const result = await elk.layout(layoutGraph({ ...fixture, direction }));
      const start = result.children.find(
        (n) => n.id === fixture.nodes.find((n) => n.kind === "start").id,
      );
      for (const node of result.children)
        assert.ok(direction === "DOWN" ? start.y <= node.y : start.x <= node.x);
      for (const edge of result.edges) {
        assert.ok(edge.sections?.length);
        const section = edge.sections[0];
        const points = [
          section.startPoint,
          ...(section.bendPoints ?? []),
          section.endPoint,
        ];
        const original = fixture.edges.find((e) => e.id === edge.id);
        for (const n of result.children.filter(
          (n) => n.id !== original.source && n.id !== original.target,
        )) {
          for (let i = 1; i < points.length; i++) {
            const a = points[i - 1],
              b = points[i];
            if (a.x === b.x)
              assert.ok(
                !(
                  a.x > n.x + 1 &&
                  a.x < n.x + n.width - 1 &&
                  Math.max(a.y, b.y) > n.y + 1 &&
                  Math.min(a.y, b.y) < n.y + n.height - 1
                ),
              );
            if (a.y === b.y)
              assert.ok(
                !(
                  a.y > n.y + 1 &&
                  a.y < n.y + n.height - 1 &&
                  Math.max(a.x, b.x) > n.x + 1 &&
                  Math.min(a.x, b.x) < n.x + n.width - 1
                ),
              );
          }
          for (const l of edge.labels ?? [])
            assert.ok(
              l.x + l.width <= n.x ||
                n.x + n.width <= l.x ||
                l.y + l.height <= n.y ||
                n.y + n.height <= l.y,
            );
        }
      }
    }
});

test("branch label edits preserve routes; a move invalidates them", () => {
  const d = structuredClone(purchaseFixture),
    p = {};
  const before = geometryKey(d, p);
  d.edges[0].label = "A manually edited branch label";
  assert.equal(geometryKey(d, p), before);
  p[d.nodes[0].id] = { x: 10, y: 10 };
  assert.notEqual(geometryKey(d, p), before);
});

test("manual arrow labels have visible bounds even when initially unlabeled", async () => {
  const { routeLabelBox } = await import("../app/lib/flowchart/route-label.ts");
  const route = {
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 200 },
    ],
  };
  assert.equal(routeLabelBox(route, ""), undefined);
  const box = routeLabelBox(route, "New branch");
  assert.ok(box.width > 0);
  assert.equal(box.y, 88);
  const labeled = { ...route, label: { x: 10, y: 10, width: 30, height: 24 } };
  const expanded = routeLabelBox(labeled, "A longer branch label");
  assert.ok(expanded.width > 30);
  assert.equal(expanded.x + expanded.width / 2, 25);
});

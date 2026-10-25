import test from "node:test";
import assert from "node:assert/strict";
import {
  statements,
  extractScope,
  mergeReplacement,
} from "../app/lib/openui/refinement/scope.ts";
const source =
  'root = Col([card, other])\ncard = Card([label])\nlabel = Text("Hello")\nother = Text("Untouched")';
test("scoped replacement preserves all unrelated original source and namespaces additions", () => {
  const { program } = mergeReplacement(
    source,
    "card",
    'replacement = Card([newLabel])\nnewLabel = Text("Changed")',
  );
  assert.ok(program.includes('other = Text("Untouched")'));
  assert.ok(program.includes("root = Col([card, other])"));
  assert.ok(!program.includes('label = Text("Hello")'));
  assert.ok(program.includes('iiRefine_newLabel = Text("Changed")'));
});
test("extracts dependency closure without unrelated content", () => {
  const { source: s } = extractScope(source, "card");
  assert.ok(s.includes("label ="));
  assert.ok(!s.includes("other ="));
});
test("rejects global replacement, outside references, state writes and reused targets", () => {
  for (const patch of [
    "replacement = Card([other])",
    "replacement = Card([])\n$count = 2",
    'replacement = Card([Action("set", "$other", 2)])',
  ])
    assert.throws(() => mergeReplacement(source, "card", patch));
  assert.throws(() =>
    extractScope(
      source.replace("[card, other]", "[card, card, other]"),
      "card",
    ),
  );
});
test("handles multiline strings/brackets and duplicate identifiers fail closed", () => {
  assert.equal(
    statements('root = Col([\nText("a ) = b"),\nText("next")\n])').length,
    1,
  );
  assert.throws(() => statements('a = Text("one")\na = Text("two")'));
});
import {
  normalizeSelectionProgram,
  selectionIndex,
} from "../app/lib/openui/refinement/scope.ts";
test("inline identities are deterministic and do not rewrite quoted content or shared state", () => {
  const s = 'root = Col([Card([Text("Card([fake])"), Button("Go")])])';
  const names = ["Col", "Card", "Text", "Button"];
  const n = normalizeSelectionProgram(s, names);
  assert.equal(normalizeSelectionProgram(n, names), n);
  assert.ok(n.includes('Text("Card([fake])")'));
  const index = selectionIndex(n, names);
  const button = Object.values(index).find((n) => n.type === "Button");
  assert.equal(index[button.parentId].type, "Card");
  const merged = mergeReplacement(
    n,
    button.id,
    'replacement = Button("Continue")',
  ).program;
  assert.ok(merged.includes('Text("Card([fake])")'));
  assert.ok(merged.includes('Button("Continue")'));
});
test("shared ancestors mark descendants unsafe; email strings are not executable syntax", () => {
  const index = selectionIndex(
    source.replace("[card, other]", "[card, card, other]"),
    ["Col", "Card", "Text"],
  );
  assert.equal(index.label.safe, false);
  assert.doesNotThrow(() =>
    mergeReplacement(
      source,
      "card",
      'replacement = Card([Text("you@example.com")])',
    ),
  );
});
test("object property names are not renamed with declaration identities", () => {
  const merged = mergeReplacement(
    source,
    "card",
    'replacement = Card([text])\ntext = Text(config.text)\nconfig = {text: "Hi"}',
  );
  assert.ok(merged.program.includes('{text: "Hi"}'));
});
import { correctSelection } from "../app/lib/openui/refinement/recovery.ts";
test("scoped correction is bounded and refusal never becomes a global edit", async () => {
  let calls = 0,
    resets = 0;
  const inspect = (text) => ({
    program: text,
    valid: text === "good",
    errors: ["Bad settings"],
  });
  const result = await correctSelection(
    "change selection",
    async () => (++calls === 1 ? "bad" : "good"),
    inspect,
    () => resets++,
  );
  assert.ok(result.valid);
  assert.equal(calls, 2);
  assert.equal(resets, 1);
  calls = 0;
  await correctSelection(
    "change selection",
    async () => {
      calls++;
      return "bad";
    },
    inspect,
    () => {},
  );
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    () =>
      correctSelection(
        "move outside",
        async () => {
          calls++;
          return "OUT_OF_SCOPE";
        },
        inspect,
        () => {},
      ),
    /larger selection/,
  );
  assert.equal(calls, 1);
});
test("cyclic and detached patch definitions are rejected before rendering", () => {
  assert.throws(
    () =>
      mergeReplacement(
        source,
        "card",
        "replacement = Card([loop])\nloop = Card([replacement])",
      ),
    /circular/,
  );
  assert.throws(
    () =>
      mergeReplacement(
        source,
        "card",
        'replacement = Card([])\nother = Text("Outside")',
      ),
    /inside/,
  );
});
test("shared dependencies survive and repeated scoped edits do not accumulate old subtrees", () => {
  const shared = source.replace(
    'other = Text("Untouched")',
    "other = Card([label])",
  );
  assert.ok(
    mergeReplacement(
      shared,
      "card",
      'replacement = Card([Text("New")])',
    ).program.includes('label = Text("Hello")'),
  );
  let current = source;
  for (let i = 0; i < 50; i++)
    current = mergeReplacement(
      current,
      "card",
      `replacement = Card([label])\nlabel = Text("Edit ${i}")`,
    ).program;
  assert.equal(statements(current).length, 4);
  assert.ok(current.length < 1000);
  assert.ok(current.includes('other = Text("Untouched")'));
});
import { interfaceFingerprint } from "../app/lib/openui/refinement/scope.ts";
test("meaningful change checks ignore parser bookkeeping but retain real content", () => {
  const a = {
    type: "element",
    typeName: "Button",
    statementId: "a",
    partial: false,
    props: { label: "Go", action: null },
  };
  const b = {
    ...a,
    statementId: "b",
    partial: true,
    props: { action: null, label: "Go" },
  };
  assert.equal(interfaceFingerprint(a), interfaceFingerprint(b));
  assert.notEqual(
    interfaceFingerprint(a),
    interfaceFingerprint({ ...b, props: { ...b.props, label: "Next" } }),
  );
});
test("exponentially repeated component references cannot overwhelm the preview", () => {
  let patch = "replacement = Card([a0])\n";
  for (let i = 0; i < 20; i++)
    patch += `a${i} = Card([a${i + 1}, a${i + 1}])\n`;
  patch += 'a20 = Text("End")';
  assert.throws(() => mergeReplacement(source, "card", patch), /too large/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createParser } from "@openuidev/lang-core";
import spec from "../app/lib/openui/generated/spec.json" with { type: "json" };
import liveFixtures from "../docs/verification/openui-benchmark.json" with { type: "json" };
import {
  pricingSample,
  statsSample,
  formSample,
  chartSample,
  iconStatsSample,
} from "../app/lib/openui/examples.ts";
import {
  decodeModelEvent,
  cleanProgram,
  hasUsefulContent,
} from "../app/lib/openui/protocol.ts";
import { allowedOrigin, generationInput } from "../app/lib/openui/request.ts";

import { generateWithCorrection } from "../app/lib/openui/recovery.ts";

const parser = createParser(spec.schema, "Col");

for (const [name, program] of Object.entries({
  pricingSample,
  statsSample,
  formSample,
  chartSample,
  iconStatsSample,
})) {
  test(`${name} satisfies the actual component contract`, () => {
    const result = parser.parse(program);
    assert.deepEqual(result.meta.errors, []);
    assert.deepEqual(result.meta.unresolved, []);
    assert.equal(result.meta.incomplete, false);
    assert.equal(hasUsefulContent(result.root), true);
  });
}

test("an empty streamed root is not counted as visible content", () => {
  assert.equal(hasUsefulContent(parser.parse("root = Col([])").root), false);
  assert.equal(
    hasUsefulContent(
      parser.parse('root = Col([title])\ntitle = Title("Hello")').root,
    ),
    true,
  );
});

test("unsupported component output reports a validation error", () => {
  const result = parser.parse(
    'root = Col([content])\ncontent = HtmlView("<script>no</script>")',
  );
  assert.ok(
    result.meta.errors.length ||
      result.meta.unresolved.length ||
      !hasUsefulContent(result.root),
  );
  assert.equal("HtmlView" in spec.components, false);
});

test("transport decodes response deltas, completion, errors and tool attempts", () => {
  assert.deepEqual(
    decodeModelEvent({
      event: "step_update",
      step_update: { step_type: "agent_response", text_delta: "root = " },
    }),
    { kind: "delta", text: "root = " },
  );
  assert.deepEqual(
    decodeModelEvent({
      event: "result",
      result: { status: "SUCCESS", response: "screen" },
    }),
    { kind: "complete", text: "screen" },
  );
  assert.equal(
    decodeModelEvent({
      event: "result",
      result: { status: "ERROR", error: "limit" },
    }).kind,
    "error",
  );
  assert.equal(
    decodeModelEvent({
      event: "step_update",
      step_update: { step_type: "tool_call" },
    }).kind,
    "tool",
  );
  assert.equal(
    decodeModelEvent({
      event: "step_update",
      step_update: { step_type: "thinking", text_delta: "private" },
    }),
    null,
  );
});

test("only surrounding program fences are removed", () => {
  assert.equal(
    cleanProgram('```openui-lang\nroot = Col([Text("`code`")])\n```'),
    'root = Col([Text("`code`")])',
  );
});

test("generation input is bounded and validates optional refinement context", () => {
  assert.deepEqual(generationInput({ prompt: "  Pricing cards  " }), {
    prompt: "Pricing cards",
    previous: "",
  });
  for (const input of [
    null,
    [],
    { prompt: 2 },
    { prompt: "hi" },
    { prompt: "a".repeat(20001) },
    { prompt: "valid", previous: {} },
    { prompt: "valid", previous: "a".repeat(64001) },
  ])
    assert.equal(generationInput(input), null);
});

test("browser calls must have a matching origin", () => {
  assert.equal(
    allowedOrigin(
      new Request("http://unrelated.example:3000/api", {
        headers: { origin: "http://unrelated.example:3000" },
      }),
    ),
    false,
  );
  assert.equal(
    allowedOrigin(
      new Request("http://127.0.0.1:3000/api", {
        headers: { origin: "http://127.0.0.1:3000" },
      }),
    ),
    true,
  );
  assert.equal(
    allowedOrigin(
      new Request("http://127.0.0.1:3000/api", {
        headers: { origin: "https://unrelated.example" },
      }),
    ),
    false,
  );
  assert.equal(allowedOrigin(new Request("http://127.0.0.1:3000/api")), true);
});

test("browser origin uses validated Host rather than Next internal hostname", () => {
  const request = (host, origin) => new Request("http://localhost:3000/api", {
    headers: { host, origin },
  });
  assert.equal(allowedOrigin(request("127.0.0.1:3000", "http://127.0.0.1:3000")), true);
  assert.equal(allowedOrigin(request("localhost:3000", "http://localhost:3000")), true);
  assert.equal(allowedOrigin(request("[::1]:3000", "http://[::1]:3000")), true);
  for (const [host, origin] of [
    ["127.0.0.1:3000", "http://127.0.0.1:3001"],
    ["127.0.0.1:3000", "http://localhost:3000"],
    ["evil.example:3000", "http://evil.example:3000"],
    ["127.0.0.1.evil.example:3000", "http://127.0.0.1.evil.example:3000"],
    ["127.0.0.1:3000", "null"],
    ["127.0.0.1:3000", "not-a-url"],
    ["localhost:99999", "http://localhost:99999"],
    ["localhost@evil.example", "http://evil.example"],
  ]) assert.equal(allowedOrigin(request(host, origin)), false, `${host} / ${origin}`);
});

test("Row alignment cannot occupy the numeric spacing argument", () => {
  const result = parser.parse(
    'root = Col([row])\nrow = Row([Title("Revenue")], "center")',
  );
  assert.ok(result.meta.errors.some((error) => error.message.includes("gap")));
});

test("all recorded final Gemini fixtures satisfy the registered component contract", () => {
  assert.equal(liveFixtures.results.length, 6);
  for (const fixture of liveFixtures.results) {
    assert.equal(fixture.type, "complete", fixture.name);
    const result = parser.parse(fixture.program);
    assert.deepEqual(result.meta.errors, [], fixture.name);
    assert.deepEqual(result.meta.unresolved, [], fixture.name);
    assert.equal(result.meta.incomplete, false, fixture.name);
    assert.equal(hasUsefulContent(result.root), true, fixture.name);
  }
});

test("the recorded live refinement preserves all pricing content except the requested price and badge", () => {
  const before = liveFixtures.results.find(
    (fixture) => fixture.name === "pricing",
  ).program;
  const after = liveFixtures.results.find(
    (fixture) => fixture.name === "refinement",
  ).program;
  assert.equal(
    after,
    before
      .replace('"$29"', '"$39"')
      .replace('Badge("Popular"', 'Badge("Best value"'),
  );
});

const inspectFixture = (program) => {
  const result = parser.parse(program);
  const errors = result.meta.errors.map(error => error.message);
  return { program, errors, valid: !errors.length && !result.meta.incomplete && !result.meta.unresolved.length && hasUsefulContent(result.root) };
};

test("invalid soft IconButton is corrected once and checked again", async () => {
  const invalid = 'root = Col([IconButton("users", null, "Users", "soft")])';
  assert.equal(inspectFixture(invalid).valid, false);
  const calls = [];
  let resets = 0;
  const result = await generateWithCorrection("Create four stats cards", async instruction => {
    calls.push(instruction);
    return calls.length === 1 ? invalid : iconStatsSample;
  }, inspectFixture, () => resets++);
  assert.equal(result.valid, true);
  assert.equal(calls.length, 2);
  assert.equal(resets, 1);
  assert.match(calls[1], /variant/);
  assert.match(calls[1], /Create four stats cards/);
  assert.equal((result.program.match(/= Card\(/g) || []).length, 4);
});

test("valid output has no correction latency; repeated invalid output stops", async () => {
  let calls = 0;
  const valid = await generateWithCorrection("Stats", async () => { calls++; return iconStatsSample; }, inspectFixture, () => assert.fail("Unexpected correction"));
  assert.equal(valid.valid, true);
  assert.equal(calls, 1);
  calls = 0;
  const invalid = await generateWithCorrection("Stats", async () => { calls++; return 'root = Col([IconButton("users", null, "Users", "soft")])'; }, inspectFixture, () => {});
  assert.equal(invalid.valid, false);
  assert.equal(calls, 2);
});

test("cancel or model errors during correction propagate without more attempts", async () => {
  let calls = 0;
  await assert.rejects(generateWithCorrection("Stats", async () => {
    if (++calls === 1) return 'root = Col([IconButton("users", null, "Users", "soft")])';
    throw new Error("Generation stopped.");
  }, inspectFixture, () => {}), /Generation stopped/);
  assert.equal(calls, 2);
});

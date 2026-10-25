import test from "node:test";
import assert from "node:assert/strict";
import { createParser } from "@openuidev/lang-core";
import spec from "../app/lib/openui/modern/generated/spec.json" with { type: "json" };
import { blockExamples } from "../app/lib/openui/modern/blocks/examples.ts";
import { blockConfigurationIssues } from "../app/lib/openui/modern/blocks/validation.ts";
import { hasUsefulContent } from "../app/lib/openui/protocol.ts";
const parser = createParser(spec.schema, "Page");
for (const [name, program] of Object.entries(blockExamples)) {
  test(`Modern ${name} block program satisfies the real contract`, () => {
    const result = parser.parse(program);
    assert.deepEqual(result.meta.errors, []);
    assert.deepEqual(result.meta.unresolved, []);
    assert.equal(result.meta.incomplete, false);
    assert.deepEqual(blockConfigurationIssues(result.root), []);
    assert.equal(hasUsefulContent(result.root, 300, "modern"), true);
  });
}
test("duplicate sidebar and metric IDs are rejected", () => {
  const duplicateMetrics = parser.parse(
    'root = Page([MetricCards([{id:"a",label:"A",value:"1"},{id:"a",label:"B",value:"2"}])])',
  );
  assert.equal(blockConfigurationIssues(duplicateMetrics.root).length, 1);
  const duplicateNav = parser.parse(
    'root = Page([AppShell("App",[{id:"g",items:[{id:"a",label:"A"},{id:"a",label:"B"}]}],"Home",[])])',
  );
  assert.equal(blockConfigurationIssues(duplicateNav.root).length, 1);
});
test("an incomplete metric block is not useful content", () => {
  assert.equal(
    hasUsefulContent(
      { typeName: "MetricCards", props: { items: [] } },
      300,
      "modern",
    ),
    false,
  );
});
test("Modern primitive-only layouts remain supported", () => {
  const result = parser.parse(
    'root = Page([Heading("Overview","h1"),Card([TextContent("Hello")],"Summary")])',
  );
  assert.deepEqual(result.meta.errors, []);
  assert.deepEqual(blockConfigurationIssues(result.root), []);
});

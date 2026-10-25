import test from "node:test";
import assert from "node:assert/strict";
import { createParser } from "@openuidev/lang-core";
import {
  cellText,
  numericCell,
  collectRows,
  collectionPage,
} from "../app/lib/openui/local/collection.ts";
import { localTitle, shortTitle } from "../app/lib/workspace/model.ts";
import { hasUsefulContent } from "../app/lib/openui/protocol.ts";
import defaults from "../app/lib/openui/generated/spec.json" with { type: "json" };
import modern from "../app/lib/openui/modern/generated/spec.json" with { type: "json" };
import fixtures from "../docs/verification/local-interactions/fixtures.json" with { type: "json" };
const badge = (label) => ({
  type: "element",
  typeName: "Badge",
  props: { label },
});
const rows = [
    ["Maya", "$120", badge("Open")],
    ["Alex", "$30", badge("Closed")],
    ["Leah", "$240", badge("Open")],
    ["Sam", "$10", badge("Open")],
  ],
  columns = ["Customer", "Amount", "Status"];
test("collection text indexes visible component text and numeric cells", () => {
  assert.equal(cellText(badge("Open")), "Open");
  assert.equal(numericCell("₹1,200"), 1200);
  assert.equal(numericCell("$1.2k"), 1200);
  assert.equal(numericCell("not a number"), null);
});
test("search filters and numeric sort compose without mutating rows", () => {
  const result = collectRows(
    rows,
    columns,
    "a",
    { Status: "Open" },
    { column: 1, direction: "desc" },
  );
  assert.deepEqual(
    result.map((r) => r[0]),
    ["Leah", "Maya", "Sam"],
  );
  assert.equal(rows[0][0], "Maya");
  assert.deepEqual(
    collectRows(rows, columns, "leah", { Status: "Open" }, null).map(
      (r) => r[0],
    ),
    ["Leah"],
  );
  assert.equal(collectRows(rows, columns, "nobody", {}, null).length, 0);
});
test("pagination clamps after filtering and handles no results", () => {
  assert.deepEqual(collectionPage([1, 2], 9, 2), {
    page: 1,
    total: 1,
    items: [1, 2],
  });
  assert.deepEqual(collectionPage([], 2, 5), { page: 1, total: 1, items: [] });
});
test("both catalogs accept all local form and collection configurations", () => {
  for (const g of fixtures.generations) {
    const r = createParser(
      (g.theme === "modern" ? modern : defaults).schema,
      g.theme === "modern" ? "Page" : "Col",
    ).parse(g.program);
    assert.deepEqual(r.meta.errors, [], g.id);
    assert.deepEqual(r.meta.unresolved, [], g.id);
    assert.equal(r.meta.incomplete, false, g.id);
    assert.equal(hasUsefulContent(r.root, 300, g.theme), true, g.id);
  }
});
test("DataList alone is recognized as useful streamed content", () => {
  const result = createParser(modern.schema, "Page").parse(
    'root = Page([DataList([{id:"a",title:"Task"}])])',
  );
  assert.equal(hasUsefulContent(result.root, 300, "modern"), true);
});
test("automatic and display titles stay within five meaningful words", () => {
  assert.equal(
    localTitle("Create a clean contact form with name, email and message."),
    "Contact form",
  );
  assert.equal(localTitle("Purchase approval process: employee submits a request"), "Purchase approval process");
  assert.equal(
    localTitle(
      "Polished login screen for a fictional productivity app using AuthLayout",
    ),
    "Login screen",
  );
  assert.equal(
    localTitle("A customer requests a refund"),
    "Customer requests a refund",
  );
  assert.equal(
    shortTitle("One two three four five six"),
    "One two three four five",
  );
});

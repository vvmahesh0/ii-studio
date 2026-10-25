import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { createParser } from "@openuidev/lang-core";
import defaultSpec from "../app/lib/openui/generated/spec.json" with { type: "json" };
import modernSpec from "../app/lib/openui/modern/generated/spec.json" with { type: "json" };
import { layoutLab } from "../tools/figma-adapter-poc/fixtures/layout-lab.mjs";
const base = new URL("../tools/figma-adapter-poc/", import.meta.url);
async function module(name) {
  const result = await build({
    entryPoints: [new URL(`src/${name}.ts`, base).pathname],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(result.outputFiles[0].text).toString("base64")
  );
}
const { validateDocument, safeSvg, utf8Bytes, serializePayload, parsePayload } = await module("contract");
const { simplifyHierarchy, reconcileStack } = await module("simplify");
const { importDesign } = await module("importer");
const { designSvg } = await module("transport");
const fixtures = JSON.parse(
  await readFile(new URL("fixtures/programs.json", base), "utf8"),
);
const frame = (id = "root") => ({
  id,
  name: "Vertical stack",
  kind: "frame",
  x: 0,
  y: 0,
  width: 600,
  height: 300,
  sizing: { width: "fixed", height: "fixed" },
  absolute: false,
  style: {},
  layout: {
    axis: "vertical",
    padding: [16, 16, 16, 16],
    gap: 12,
    align: "start",
    justify: "start",
    clip: false,
  },
  children: [],
});
const document = () => ({
  format: "ii-studio-design",
  version: 1,
  source: { library: "modern" },
  viewport: { width: 600, height: 300 },
  root: frame(),
  components: [],
  warnings: [],
});
test("layout lab covers fixed, hug, fill, nested stacks, clipping and absolute positioning", () => {
  const doc = validateDocument(layoutLab());
  assert.equal(doc.root.children[0].children[1].sizing.width, "fill");
  assert.equal(doc.root.children[0].children[2].sizing.width, "hug");
  assert.equal(doc.root.children[0].children[3].absolute, true);
});
for (const f of fixtures)
  test(`Figma fixture ${f.id} uses the installed catalog`, () => {
    const modern = f.library === "modern";
    const parsed = createParser(
      modern ? modernSpec.schema : defaultSpec.schema,
      modern ? "Page" : "Col",
    ).parse(f.program);
    assert.deepEqual(parsed.meta.errors, []);
    assert.deepEqual(parsed.meta.unresolved, []);
    assert.equal(parsed.meta.incomplete, false);
  });
test("strict format, revision and unknown properties", () => {
  assert.equal(validateDocument(document()).version, 1);
  assert.throws(() => validateDocument({ ...document(), version: 2 }));
  assert.throws(() => validateDocument({ ...document(), html: "<script/>" }));
});
test("duplicate IDs, invalid dimensions and deep payloads are rejected", () => {
  const doc = document();
  doc.root.children = [frame("root")];
  assert.throws(() => validateDocument(doc), /Duplicate/);
  doc.root.children = [];
  doc.root.width = NaN;
  assert.throws(() => validateDocument(doc));
  const deep = document();
  let n = deep.root;
  for (let i = 0; i < 80; i++) {
    const child = frame(String(i));
    n.children = [child];
    n = child;
  }
  assert.throws(() => validateDocument(deep), /nesting/);
});
test("payload byte limit includes Unicode", () => {
  assert.equal(utf8Bytes("₹😊"), 7);
  assert.throws(() => validateDocument("x".repeat(4194305)), /4 MB/);
});
test("SVG rejects executable and externally referenced content", () => {
  assert.equal(safeSvg('<svg><path d="M0 0 L10 10"/></svg>'), true);
  for (const s of [
    "<svg><script/></svg>",
    '<svg><image href="https://example.com"/></svg>',
    '<svg onload="x()"/>',
    '<svg><path fill="url(#a)"/></svg>',
    "<svg><foreignObject/></svg>",
  ])
    assert.equal(safeSvg(s), false);
});
test("instances must resolve and may only override native text paths", () => {
  const doc = document();
  doc.root.children = [
    { ...frame("instance"), kind: "instance", componentRef: "missing" },
  ];
  assert.throws(() => validateDocument(doc), /Missing component/);
  doc.components = [frame("master")];
  doc.root.children[0].componentRef = "master";
  assert.equal(validateDocument(doc).components.length, 1);
});
test("SVG transport escapes labels and retains text, not an embedded screenshot", () => {
  const doc = document();
  doc.root.children = [
    {
      ...frame("text"),
      kind: "text",
      text: "<Hello & world>",
      typography: {
        family: "Avenir Next",
        weight: 400,
        size: 14,
        lineHeight: 21,
        letterSpacing: 0,
        align: "left",
      },
    },
  ];
  const svg = designSvg(doc);
  assert.match(svg, /<text/);
  assert.match(svg, /&lt;Hello &amp; world&gt;/);
  assert.doesNotMatch(svg, /<image|foreignObject|figma-/);
});
test("importer validates before any Figma mutation", async () => {
  let calls = 0;
  await assert.rejects(
    importDesign(
      {
        createFrame() {
          calls++;
        },
      },
      "{}",
    ),
  );
  assert.equal(calls, 0);
});
test("font failure rolls back only new nodes", async () => {
  const doc = document();
  doc.root.children = [
    {
      ...frame("text"),
      kind: "text",
      text: "Hello",
      typography: {
        family: "Avenir Next",
        weight: 400,
        size: 14,
        lineHeight: 21,
        letterSpacing: 0,
        align: "left",
      },
    },
  ];
  const created = [];
  function node(type) {
    const n = {
      type,
      id: String(created.length),
      removed: false,
      children: [],
      appendChild(c) {
        this.children.push(c);
      },
      resize(w, h) {
        this.width = w;
        this.height = h;
      },
      remove() {
        this.removed = true;
      },
    };
    created.push(n);
    return n;
  }
  const api = {
    listAvailableFontsAsync: async () => [
      { fontName: { family: "Inter", style: "Regular" } },
    ],
    loadFontAsync: async () => {
      throw new Error("Font failed");
    },
    createFrame: () => node("FRAME"),
    createText: () => node("TEXT"),
    currentPage: { appendChild() {} },
    viewport: {},
  };
  await assert.rejects(importDesign(api, doc), /Font failed/);
  assert.equal(created.length, 0, "font resources are prepared before creating any nodes");
  assert.ok(created.every((n) => n.removed));
});

test("marked payloads and legacy Phase 0 JSON remain compatible", () => {
  const payload=serializePayload(document());
  assert.ok(payload.startsWith('II_STUDIO_DESIGN_V1\n'));
  assert.equal(validateDocument(payload).version,1);
  assert.equal(validateDocument(JSON.stringify(document())).version,1);
});
test("ordinary text, malformed data and future revisions have clear errors",()=>{
  assert.throws(()=>parsePayload('hello'),/ordinary text/);
  assert.throws(()=>parsePayload('II_STUDIO_DESIGN_V2\n{}'),/not supported/);
  assert.throws(()=>parsePayload('II_STUDIO_DESIGN_V1\n{"format":'),/incomplete/);
  assert.throws(()=>parsePayload('{"format":"other"}'),/not an II studio/);
  assert.throws(()=>parsePayload(JSON.stringify({...document(),version:9})),/not supported/);
});
test("native expansion budget includes SVG descendants and repeated instances",()=>{
  const doc=document();
  doc.root.children=Array.from({length:5},(_,i)=>({...frame('vector'+i),kind:'vector',svg:'<svg>'+ '<rect width="1" height="1"/>'.repeat(1700)+'</svg>'}));
  assert.throws(()=>validateDocument(doc),/native-layer budget/);
  const repeat=document();repeat.components=[{...frame('master'),children:Array.from({length:100},(_,i)=>frame('master'+i))}];
  repeat.root.children=Array.from({length:80},(_,i)=>({...frame('instance'+i),kind:'instance',componentRef:'master'}));
  assert.throws(()=>validateDocument(repeat),/native-layer budget/);
});
test("instance override paths are checked before Figma mutation",()=>{
  const doc=document();doc.components=[frame('master')];doc.root.children=[{...frame('instance'),kind:'instance',componentRef:'master',overrides:{'9.8':'Invalid'}}];
  assert.throws(()=>validateDocument(doc),/Invalid instance text path/);
});
test("safe wrapper simplification preserves styled, semantic and layout frames",()=>{
  const doc=document();const wrapper={...frame('wrapper'),layout:{...frame().layout,axis:'none',padding:[0,0,0,0]},x:12,y:18};
  wrapper.children=[{...frame('child'),x:0,y:0}];doc.root.children=[wrapper];
  assert.equal(simplifyHierarchy(structuredClone(doc.root)).children[0].id,'child');
  for(const mutate of [n=>n.layout.axis='vertical',n=>n.layout.clip=true,n=>n.layout.padding[0]=10,n=>n.style.fill={r:1,g:1,b:1,a:1},n=>n.id='source:card',n=>n.absolute=true]){
    const copy=structuredClone(doc.root);mutate(copy.children[0]);assert.notEqual(simplifyHierarchy(copy).children[0].id,'child');
  }
});
test("stack gap inference includes measured CSS margin and border inset",()=>{
  const n=frame();n.height=120;n.children=[{...frame('a'),x:16,y:17,width:100,height:20},{...frame('b'),x:16,y:65,width:100,height:20}];
  reconcileStack(n);assert.equal(n.layout.gap,28);assert.equal(n.layout.padding[0],17);assert.equal(n.layout.padding[2],16);
});
test("unequal margins get intentional spacing frames; overlaps stay measured",()=>{
  const n=frame();n.children=[{...frame('a'),y:0,height:20},{...frame('b'),y:32,height:20},{...frame('c'),y:80,height:20}];
  reconcileStack(n);assert.equal(n.layout.gap,12);assert.equal(n.children[2].layout.padding[0],16);assert.equal(n.children[2].children[0].y,16);
  const overlap=frame();overlap.children=[{...frame('a'),y:0,height:40},{...frame('b'),y:10,height:40}];reconcileStack(overlap);assert.equal(overlap.layout.axis,'none');
});

test('mid-creation failure rolls back all new layers and preserves unrelated content',async()=>{
 const doc=document();doc.root.children=[{...frame('child'),kind:'shape'}];
 const created=[],unrelated={removed:false};
 const api={listAvailableFontsAsync:async()=>[],currentPage:{appendChild(){}},
 createFrame(){const n={type:'FRAME',id:'new',removed:false,appendChild(){},resize(){},remove(){this.removed=true;}};created.push(n);return n;},
 createRectangle(){throw new Error('Creation failed');}};
 await assert.rejects(importDesign(api,doc),/Creation failed/);assert.equal(created.length,1);assert.equal(created[0].removed,true);assert.equal(unrelated.removed,false);
});
test('SVG numeric expansion is bounded before native creation',()=>{
 const doc=document();doc.root.children=[{...frame('vector'),kind:'vector',svg:'<svg><polygon points="'+'1 1 '.repeat(26000)+'"/></svg>'}];
 assert.throws(()=>validateDocument(doc),/geometry is too complex/);
});

test('wide button rows keep free flex space out of padding',()=>{const n=frame();n.width=1600;n.layout.axis='horizontal';n.children=[{...frame('button'),x:16,y:0,width:80,height:30}];reconcileStack(n);assert.equal(n.layout.padding[1],16);assert.doesNotThrow(()=>validateDocument({...document(),root:n}));});

test('nonsemantic descendants of source components can lose only safe wrappers',()=>{const n={...frame('source:card/0'),layout:{...frame().layout,axis:'none',padding:[0,0,0,0]},children:[frame('source:card/0/0')]};n.children[0].x=n.children[0].y=0;const doc=frame();doc.children=[n];assert.equal(simplifyHierarchy(doc).children[0].id,'source:card/0/0');});
const {reuseMetricCards}=await module('extractor');
test('optional component reuse never rejects unrelated or differently styled screens',()=>{const d=document();assert.doesNotThrow(()=>reuseMetricCards(d,false));const metrics={...frame('metrics'),name:'MetricCards',children:[frame('a'),frame('b'),frame('c')]};metrics.children[1].style.fill={r:1,g:0,b:0,a:1};d.root.children=[metrics];const result=reuseMetricCards(d,false);assert.equal(result.components.length,0);assert.equal(d.root.children[0].children[0].kind,'frame');assert.throws(()=>reuseMetricCards(d),/different structures/);});

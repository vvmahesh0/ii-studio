// Library-independent DesignIR fixture; diagnostic, not model-generated output.
const color = { r: 0.93, g: 0.96, b: 1, a: 1 };
function frame(id, name, width, height, axis = "vertical") {
  return {
    id,
    name,
    kind: "frame",
    x: 0,
    y: 0,
    width,
    height,
    sizing: { width: "fixed", height: "fixed" },
    absolute: false,
    style: { fill: color, radius: 8 },
    layout: {
      axis,
      padding: [8, 8, 8, 8],
      gap: 12,
      align: "center",
      justify: "start",
      clip: false,
    },
    children: [],
  };
}
function label(id, text) {
  return {
    ...frame(id, text, 90, 21, "none"),
    kind: "text",
    style: { fill: { r: 0.08, g: 0.16, b: 0.27, a: 1 } },
    text,
    typography: {
      family: "Avenir Next",
      weight: 400,
      size: 14,
      lineHeight: 21,
      letterSpacing: 0,
      align: "left",
    },
  };
}
export function layoutLab() {
  const root = frame("lab", "Layout translation lab", 720, 460);
  root.style.fill = { r: 1, g: 1, b: 1, a: 1 };
  root.layout.padding = [24, 24, 24, 24];
  root.layout.align = "start";
  const row = frame("row", "Fixed, Fill and Hug", 672, 70, "horizontal");
  row.sizing.width = "fill";
  row.layout.clip = true;
  const fixed = frame("fixed", "Fixed 120", 120, 48);
  fixed.children = [label("fixed-label", "Fixed")];
  const fill = frame("fill", "Fill remaining space", 240, 48, "horizontal");
  fill.sizing.width = "fill";
  fill.children = [label("fill-label", "Fill")];
  const hug = frame("hug", "Hug content", 110, 48, "horizontal");
  hug.sizing.width = "hug";
  hug.children = [label("hug-label", "Hug")];
  const absolute = {
    ...frame("absolute", "Absolute marker", 12, 12, "none"),
    kind: "shape",
    x: 640,
    y: 4,
    absolute: true,
    style: { fill: { r: 0, g: 0.6, b: 0.5, a: 1 } },
  };
  row.children = [fixed, fill, hug, absolute];
  const column = frame("nested", "Nested vertical stack", 672, 130);
  column.sizing.width = "fill";
  column.layout.align = "start";
  column.children = [
    label("label1", "First step"),
    label("label2", "Second step"),
  ];
  const grid = frame("grid", "Measured two-row grid", 672, 140, "none");
  grid.sizing.width = "fill";
  grid.children = Array.from({ length: 4 }, (_, i) => ({
    ...frame("cell" + i, "Grid cell " + (i + 1), 300, 50),
    x: (i % 2) * 324 + 8,
    y: Math.floor(i / 2) * 62 + 8,
    children: [label("cell-label" + i, "Cell " + (i + 1))],
  }));
  root.children = [row, column, grid];
  return {
    format: "ii-studio-design",
    version: 1,
    source: { library: "modern", artifactId: "layout-lab" },
    viewport: { width: 720, height: 460 },
    components: [],
    root,
    warnings: [],
  };
}

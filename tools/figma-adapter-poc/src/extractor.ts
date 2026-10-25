import {
  safeSvg,
  validateDocument,
  type Color,
  type DesignDocument,
  type DesignNode,
} from "./contract";
import { reconcileStack, simplifyHierarchy } from "./simplify";

export type SemanticEntry = { type: string; label: string };
export type ExtractOptions = {
  source: DesignDocument["source"];
  semantics: Record<string, SemanticEntry>;
  name: string;
};
const num = (v: string) => Number.parseFloat(v) || 0;
const r = (v: number) => Math.round(v * 100) / 100;

/** Measurements come from the rendered library; IDs/names come from parsed
 * OpenUI. Only normalized supported styles enter DesignIR, never raw HTML. */
export async function extractDesign(
  root: HTMLElement,
  options: ExtractOptions,
) {
  const start = performance.now();
  await document.fonts.ready;
  if (!root.isConnected || !root.offsetWidth)
    throw new Error("Open a completed interface preview first.");
  if (root.querySelectorAll("*").length > 3000)
    throw new Error("This interface exceeds the supported 3,000-element capture budget.");
  if (root.querySelector("img,canvas,video,iframe"))
    throw new Error(
      "Images, canvases and embedded media are not supported as editable Figma layers yet. Use Export PNG for these interfaces.",
    );
  if (document.querySelector(".iui-popover") && root.querySelector('.iui-popover-trigger[aria-expanded="true"]'))
    throw new Error("Close the open popover before copying for Figma.");
  if(root.querySelector('[role="dialog"], [data-radix-popper-content-wrapper]'))
    throw new Error("Close the open dialog or floating panel before copying for Figma. Export the base interface first.");
  for(const el of root.querySelectorAll('*')){
    const style=getComputedStyle(el);
    if(/auto|scroll/.test(style.overflowY) && el.scrollHeight>el.clientHeight+3 && el.clientHeight>0)
      throw new Error("This interface contains a scrolling panel. Expand its content before copying for Figma, or use Export PNG.");
  }
  const warnings = new Set<string>(),
    ids = new Map<string, number>();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d")!;
  function color(css: string): Color {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = "transparent";
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    const [red, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return { r: red / 255, g: g / 255, b: b / 255, a: a / 255 };
  }
  function id(key: string) {
    const occurrence = ids.get(key) ?? 0;
    ids.set(key, occurrence + 1);
    return occurrence ? `${key}@${occurrence}` : key;
  }
  function typography(style: CSSStyleDeclaration) {
    return {
      family: style.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
      weight: num(style.fontWeight) || 400,
      size: num(style.fontSize) || 14,
      lineHeight: num(style.lineHeight) || num(style.fontSize) * 1.2,
      letterSpacing: num(style.letterSpacing),
      align: (style.textAlign === "center"
        ? "center"
        : style.textAlign === "right"
          ? "right"
          : "left") as "left" | "center" | "right",
    };
  }
  function makeText(
    text: string,
    rect: DOMRect,
    parent: DOMRect,
    key: string,
    style: CSSStyleDeclaration,
  ): DesignNode {
    const t = typography(style);
    if (/^[↕↑↓]$/.test(text.trim())) {
      const stroke=style.color.replace(/["<>]/g,"");
      const direction=text.trim();
      const path=direction==='↑'?'M4 13V3m-3 3 3-3 3 3':direction==='↓'?'M4 3v10m-3-3 3 3 3-3':'M3 13V3m-2 2 2-2 2 2m4-2v10m-2-2 2 2 2-2';
      return {id:id(key),name:'Sort direction',kind:'vector',x:r(rect.x-parent.x),y:r(rect.y-parent.y),width:Math.max(1,r(rect.width)),height:Math.max(1,r(rect.height)),sizing:{width:'fixed',height:'fixed'},absolute:false,style:{},svg:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="16" viewBox="0 0 12 16"><path d="'+path+'" fill="none" stroke="'+stroke+'" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',children:[]};
    }
    return {
      id: id(key),
      name: `Text · ${text.slice(0, 60)}`,
      kind: "text",
      x: r(rect.x - parent.x),
      y: r(rect.y - parent.y),
      width: Math.max(1, r(rect.width)),
      height: Math.max(1, r(rect.height)),
      sizing: { width: "fixed", height: "fixed" },
      absolute: false,
      style: { fill: color(style.color) },
      text,
      typography: t,
      children: [],
    };
  }
  function visit(
    el: Element,
    parentRect: DOMRect,
    key: string,
  ): DesignNode | null {
    const s = getComputedStyle(el);
    let box = el.getBoundingClientRect();
    if (
      s.display === "none" ||
      s.visibility === "hidden" ||
      num(s.opacity) === 0 ||
      el.matches("script,style,defs,option")
    )
      return null;
    // Recharts uses a zero-size measuring wrapper around a positioned chart.
    // A zero-size parent is not evidence that its visible descendants are empty.
    if (box.width < 0.1 || box.height < 0.1) {
      const bounds = [...el.children]
        .map((c) => c.getBoundingClientRect())
        .filter((b) => b.width > 0.1 && b.height > 0.1);
      if (!bounds.length) return null;
      const x = Math.min(...bounds.map((b) => b.x)),
        y = Math.min(...bounds.map((b) => b.y));
      box = new DOMRect(
        x,
        y,
        Math.max(...bounds.map((b) => b.right)) - x,
        Math.max(...bounds.map((b) => b.bottom)) - y,
      );
    }
    const sourceId = el.getAttribute("data-ii-selection");
    const semantic = sourceId ? options.semantics[sourceId] : undefined;
    const type = semantic?.type ?? el.getAttribute("data-ii-component");
    const heading = el.querySelector("h1,h2,h3,[data-slot=card-title]")?.textContent?.trim().slice(0,70);
    const contentName = heading && /Card|Section|Form|Table|Chart/.test(type ?? "") ? heading : semantic?.label;
    const name = type
      ? `${type} · ${contentName || sourceId}`
      : el.getAttribute("aria-label") ||
        el.getAttribute("data-slot") ||
        ({
          HEADER: "Application header",
          NAV: "Navigation",
          ASIDE: "Sidebar",
          FORM: "Form",
          TABLE: "Table",
          THEAD: "Table header",
          TBODY: "Table body",
          TR: "Table row",
          TH: "Column heading",
          TD: "Table cell",
          BUTTON: "Button",
          LABEL: "Field label",
          H1: "Page heading",
          H2: "Section heading",
        }[el.tagName.toUpperCase()] ??
          ({DIV:"Content",SPAN:"Content",P:"Paragraph",STRONG:"Brand",SVG:"Icon",UL:"Navigation items",LI:"Navigation item",MAIN:"Main content",SECTION:"Section",INPUT:"Input",TEXTAREA:"Message",SELECT:"Selection"}[el.tagName.toUpperCase()] ?? "Group"));
    const slot=el.getAttribute("data-slot");
    const label=heading || el.textContent?.trim().replace(/\s+/g," ").slice(0,55);
    const layerName=!type && slot === "card" && label ? `${label} card` : name;
    const n: DesignNode = {
      id: id(sourceId ? `source:${sourceId}` : key),
      name: layerName.slice(0, 200),
      kind: "frame",
      x: r(box.x - parentRect.x),
      y: r(box.y - parentRect.y),
      width: r(box.width),
      height: r(box.height),
      sizing: { width: "fixed", height: "fixed" },
      absolute: /absolute|fixed/.test(s.position),
      style: {
        opacity: num(s.opacity),
        radius: Math.min(1000, num(s.borderTopLeftRadius)),
      },
      children: [],
    };
    const fill = color(s.backgroundColor);
    if (fill.a) n.style.fill = fill;
    const sides=["Top","Right","Bottom","Left"] as const;
    const borders=sides.map(side=>({width:num(s[`border${side}Width`]),paint:color(s[`border${side}Color`]),style:s[`border${side}Style`]}));
    const uniform=borders.every(b=>b.width===borders[0].width&&JSON.stringify(b.paint)===JSON.stringify(borders[0].paint));
    if (uniform && num(s.borderTopWidth)) {
      n.style.stroke = color(s.borderTopColor);
      n.style.strokeWidth = num(s.borderTopWidth);
    }
    if(borders.some(b=>b.width && !['solid','none'].includes(b.style))) warnings.add("Dashed and dotted borders are approximated by solid design borders.");
    if (s.backgroundImage !== "none")
      throw new Error("This interface uses a background image or gradient that the editable Figma adapter does not yet support. Use Export PNG for a visual copy.");
    if (s.boxShadow !== "none") {
      const shadows = s.boxShadow.split(/,(?![^()]*\))/).filter(part => {
        const paint=part.match(/rgba?\([^)]+\)|#[\da-f]+/i)?.[0];
        return !paint || color(paint).a > 0;
      });
      const simple = shadows.map(part => {
        if (/inset/.test(part)) return null;
        const paint=part.match(/rgba?\([^)]+\)|#[\da-f]+/i)?.[0];
        const values=part.replace(paint ?? "", "").match(/-?[\d.]+px/g)?.map(num);
        if (!paint || !values || values.length < 3 || (values[3] ?? 0) !== 0 || values[2] > 200) return null;
        return {x:values[0],y:values[1],blur:values[2],color:color(paint)};
      });
      const supported=simple.find(Boolean);
      if (supported) n.style.shadow=supported;
      if (shadows.length > 1 || simple.some(x=>!x)) warnings.add("Complex or layered shadows use the first supported simple shadow; other effects are omitted.");
    }
    if (s.transform !== "none")
      warnings.add(
        "Transforms use their measured bounding boxes; rotation is not reproduced.",
      );
    if (el instanceof SVGSVGElement) {
      const clone = el.cloneNode(true) as SVGSVGElement;
      const originals = [el, ...el.querySelectorAll("*")],
        copies = [clone, ...clone.querySelectorAll("*")];
      originals.forEach((original, i) => {
        const computed = getComputedStyle(original),
          copy = copies[i];
        for (const prop of [
          "fill",
          "stroke",
          "stroke-width",
          "stroke-linecap",
          "stroke-linejoin",
          "opacity",
        ]) {
          const value = computed.getPropertyValue(prop);
          if (value && !/url\(/.test(value)) copy.setAttribute(prop, value);
        }
        for (const a of [...copy.attributes])
          if (/^on/i.test(a.name) || a.name === "style")
            copy.removeAttribute(a.name);
      });
      clone
        .querySelectorAll("text,foreignObject,style,script,defs")
        .forEach((e) => e.remove());
      clone.querySelectorAll("*").forEach((e) => {
        for (const a of [...e.attributes])
          if (/url\(/.test(a.value)) e.removeAttribute(a.name);
      });
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const svg = new XMLSerializer().serializeToString(clone);
      if (!safeSvg(svg))
        throw new Error("This SVG requires unsupported external references.");
      n.children.push({
        ...n,
        id: id(`${n.id}/vectors`),
        name: "Editable chart / icon vectors",
        kind: "vector",
        x: 0,
        y: 0,
        style: {},
        svg,
        children: [],
      });
      el.querySelectorAll("text").forEach((text, i) => {
        const rect = text.getBoundingClientRect();
        if (rect.width && rect.height)
          n.children.push(
            makeText(
              text.textContent ?? "",
              rect,
              box,
              `${n.id}/svg-text${i}`,
              getComputedStyle(text),
            ),
          );
      });
      n.layout = {
        axis: "none",
        padding: [0, 0, 0, 0],
        gap: 0,
        align: "start",
        justify: "start",
        clip: false,
      };
      return n;
    }
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      if(el instanceof HTMLInputElement && ["checkbox","radio","range","color","file"].includes(el.type))
        throw new Error("This native control cannot yet be converted faithfully. Use Export PNG for this interface.");
      const text =
        el instanceof HTMLSelectElement
          ? el.selectedOptions[0]?.text
          : el.value || el.getAttribute("placeholder");
      if (text) {
        const h = typography(s).lineHeight;
        const t = makeText(
          text,
          new DOMRect(
            box.x + num(s.paddingLeft),
            box.y + (el instanceof HTMLTextAreaElement ? num(s.borderTopWidth)+num(s.paddingTop) : (box.height - h) / 2),
            Math.max(1, box.width - num(s.paddingLeft) - num(s.paddingRight)),
            el instanceof HTMLTextAreaElement ? Math.max(h,box.height-num(s.paddingTop)-num(s.paddingBottom)-num(s.borderTopWidth)-num(s.borderBottomWidth)) : h,
          ),
          box,
          `${n.id}/value`,
          s,
        );
        n.children = [t];
      }
      n.layout = {
        axis: "none",
        padding: [0, 0, 0, 0],
        gap: 0,
        align: "start",
        justify: "start",
        clip: true,
      };
      return n;
    }
    let index = 0;
    for (const child of el.childNodes) {
      if (child instanceof Element) {
        const result = visit(child, box, `${n.id}/${index++}`);
        if (result) n.children.push(result);
      } else if (
        child.nodeType === Node.TEXT_NODE &&
        child.textContent?.trim()
      ) {
        const range = document.createRange();
        range.selectNodeContents(child);
        const rect = range.getBoundingClientRect();
        if (rect.width && rect.height)
          n.children.push(
            makeText(
              child.textContent.replace(/\s+/g, " "),
              rect,
              box,
              `${n.id}/text${index++}`,
              s,
            ),
          );
      }
    }
    const flex =
      /flex/.test(s.display) &&
      (s.flexWrap === "nowrap" || [...el.children].every(c=>Math.abs(c.getBoundingClientRect().y-(el.firstElementChild?.getBoundingClientRect().y ?? 0))<2)) &&
      n.children.length > 0;
    const singleGridRow =
      s.display === "grid" &&
      n.children.length > 1 &&
      n.children.every(
        (child) => !child.absolute && Math.abs(child.y - n.children[0].y) < 2,
      );
    const axis = singleGridRow
      ? "horizontal"
      : flex
        ? s.flexDirection === "column"
          ? "vertical"
          : s.flexDirection === "row"
            ? "horizontal"
            : "none"
        : "none";
    const alignment = s.alignItems.includes("center")
      ? "center"
      : s.alignItems.includes("end")
        ? "end"
        : "start";
    const justify =
      s.justifyContent === "space-between"
        ? "between"
        : s.justifyContent.includes("center")
          ? "center"
          : s.justifyContent.includes("end")
            ? "end"
            : "start";
    n.layout = {
      axis,
      padding: [
        num(s.paddingTop),
        num(s.paddingRight),
        num(s.paddingBottom),
        num(s.paddingLeft),
      ],
      gap: num(axis === "vertical" ? s.rowGap : s.columnGap),
      align: alignment,
      justify,
      clip: /hidden|clip|scroll|auto/.test(s.overflow),
    };
    reconcileStack(n);
    // Only infer FILL on actual cross-axis stretch. Grids/tables stay measured
    // absolute frames until a dedicated semantic adapter can preserve their rules.
    if (axis !== "none")
      for (const child of n.children) {
        if (child.absolute) continue;
        if (
          axis === "vertical" &&
          Math.abs(
            child.width - (n.width - n.layout.padding[1] - n.layout.padding[3]),
          ) < 3
        )
          child.sizing.width = "fill";
        if (
          axis === "horizontal" &&
          Math.abs(
            child.height -
              (n.height - n.layout.padding[0] - n.layout.padding[2]),
          ) < 3
        )
          child.sizing.height = "fill";
      }
    if(singleGridRow && n.children.every(c=>Math.abs(c.width-n.children[0].width)<2))
      for(const child of n.children) if(!child.absolute) child.sizing.width="fill";
    if(!uniform) borders.forEach((b,i)=>{
      if(!b.width||!b.paint.a)return;
      const horizontal=i===0||i===2;
      n.children.push({id:n.id+'/border'+i,name:['Top divider','Right divider','Bottom divider','Left divider'][i],kind:'shape',x:i===1?Math.max(0,n.width-b.width):0,y:i===2?Math.max(0,n.height-b.width):0,width:horizontal?n.width:Math.max(.01,b.width),height:horizontal?Math.max(.01,b.width):n.height,sizing:{width:'fixed',height:'fixed'},absolute:true,style:{fill:b.paint},children:[]});
    });
    return n;
  }
  const bounds = root.getBoundingClientRect();
  const result = visit(root, bounds, "root");
  if (!result) throw new Error("The preview is empty.");
  result.x = result.y = 0;
  result.name = options.name;
  // Reject accidental missing geometry rather than pretending to capture offscreen media.
  if (root.scrollWidth > root.clientWidth + 3)
    warnings.add(
      "Horizontal overflow uses measured content and clipping at the selected viewport.",
    );
  const output = validateDocument({
    format: "ii-studio-design",
    version: 1,
    source: options.source,
    viewport: { width: bounds.width, height: bounds.height },
    components: [],
    root: simplifyHierarchy(result),
    warnings: [...warnings],
  });
  return { document: output, extractionMs: performance.now() - start };
}

/** Deliberately small experiment: repeat one equal-structure MetricCards child.
 * Masters are local to this import, never mapped to somebody's team library. */
export function reuseMetricCards(input: DesignDocument, strict = true): DesignDocument {
  const doc = structuredClone(input);
  let applied = false;
  function signature(n: DesignNode, first = false): string {
    const geometry = n.kind === "text" ? null : {width:n.width,height:n.height,x:first?0:n.x,y:first?0:n.y};
    return `${n.kind}:${JSON.stringify(geometry)}:${JSON.stringify(n.layout)}:${JSON.stringify(n.sizing)}:${n.absolute}:${JSON.stringify(n.style)}:${JSON.stringify(n.typography)}[${n.children.map(c=>signature(c))}]`;
  }
  function visit(n: DesignNode) {
    if (!applied && n.name.startsWith("MetricCards") && n.children.length >= 3) {
      const cards = n.children;
      if (
        cards.some(
          (c) =>
            signature(c,true) !== signature(cards[0],true) ||
            Math.abs(c.width - cards[0].width) > 2 ||
            Math.abs(c.height - cards[0].height) > 2,
        )
      )
        { if(!strict) return; throw new Error(
          "Metric cards have different structures. Use independent frames.",
        ); }
      const master = structuredClone(cards[0]);
      master.id = "component:metric-card";
      master.name = "KPI card";
      function rename(c: DesignNode, path: string) {
        c.id = `component:metric-card/${path}`;
        c.children.forEach((x, i) =>
          rename(x, path ? `${path}.${i}` : String(i)),
        );
      }
      master.children.forEach((c, i) => rename(c, String(i)));
      doc.components.push(master);
      n.children = cards.map((card) => {
        const overrides: Record<string, string> = {};
        function collect(c: DesignNode, path: string) {
          if (c.kind === "text") overrides[path] = c.text!;
          c.children.forEach((x, i) =>
            collect(x, path ? `${path}.${i}` : String(i)),
          );
        }
        card.children.forEach((c, i) => collect(c, String(i)));
        return {
          ...card,
          kind: "instance",
          componentRef: master.id,
          overrides,
          children: [],
          layout: undefined,
        };
      });
      applied = true;
      return;
    }
    n.children.forEach(visit);
  }
  visit(doc.root);
  if (!applied && strict) throw new Error("No three matching KPI cards found.");
  return validateDocument(doc);
}

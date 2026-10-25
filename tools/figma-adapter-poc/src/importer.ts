import { validateDocument, type Color, type DesignNode } from "./contract";
import type {
  PluginAPI,
  SolidPaint,
  SceneNode,
  ComponentNode,
  FrameNode,
  ChildrenMixin,
  InstanceNode,
  RectangleNode,
  TextNode,
} from "../vendor/plugin-api";

const paints = (color?: Color): SolidPaint[] =>
  color
    ? [
        {
          type: "SOLID",
          color: { r: color.r, g: color.g, b: color.b },
          opacity: color.a,
        },
      ]
    : [];
const align = { start: "MIN", center: "CENTER", end: "MAX" } as const;
const styleWeights: Record<string, number> = {
  thin: 100,
  extralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  book: 400,
  medium: 500,
  demi: 600,
  demibold: 600,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  heavy: 800,
  black: 900,
};
function nativeSignature(root:SceneNode):string {
  function view(n:SceneNode):unknown {
    const common={type:n.type,width:n.width,height:n.height,x:n===root?0:n.x,y:n===root?0:n.y,radius:"cornerRadius" in n?n.cornerRadius:undefined,strokeWeight:"strokeWeight" in n?n.strokeWeight:undefined,sizing:"layoutSizingHorizontal" in n?[n.layoutSizingHorizontal,n.layoutSizingVertical]:undefined,opacity:"opacity" in n?n.opacity:undefined,fills:'fills' in n?n.fills:undefined,strokes:'strokes' in n?n.strokes:undefined,effects:"effects" in n?n.effects:undefined,layout:'layoutMode' in n?{mode:n.layoutMode,gap:n.itemSpacing,primaryAlign:n.primaryAxisAlignItems,counterAlign:n.counterAxisAlignItems,primarySizing:n.primaryAxisSizingMode,counterSizing:n.counterAxisSizingMode,clip:n.clipsContent,padding:[n.paddingTop,n.paddingRight,n.paddingBottom,n.paddingLeft]}:undefined};
    return {...common,text:n.type==='TEXT'?{characters:n.characters,font:n.fontName,size:n.fontSize,lineHeight:n.lineHeight,letterSpacing:n.letterSpacing,align:n.textAlignHorizontal,resize:n.textAutoResize}:undefined,children:'children' in n?n.children.map(view):undefined};
  }
  return JSON.stringify(view(root));
}
export async function importDesign(api: PluginAPI, input: unknown) {
  const started = Date.now(),
    doc = validateDocument(input),
    warnings = [...doc.warnings];
  const validationMs = Date.now() - started;
  const fonts = await api.listAvailableFontsAsync();
  const loaded = new Map<string, Promise<void>>();
  async function loadFont(font: { family: string; style: string }) {
    const key = font.family + "/" + font.style;
    if (!loaded.has(key))
      loaded.set(
        key,
        new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error(`Font loading timed out: ${key}`)),
            5000,
          );
          api.loadFontAsync(font).then(
            () => {
              clearTimeout(timer);
              resolve();
            },
            (error) => {
              clearTimeout(timer);
              reject(error);
            },
          );
        }),
      );
    await loaded.get(key);
  }
  const nodes = new Map<string, SceneNode>(),
    components = new Map<string, ComponentNode>();
  const created: SceneNode[] = [];
  let nativeBudget = 0;
  let holder: FrameNode | undefined, root: SceneNode | undefined;
  function fontFor(n: DesignNode) {
    const t = n.typography!;
    const family = fonts.some((f) => f.fontName.family === t.family)
      ? t.family
      : "Inter";
    const options = fonts.filter(
      (f) =>
        f.fontName.family === family &&
        !/italic|oblique/i.test(f.fontName.style),
    );
    if (!options.length)
      throw new Error(`Neither ${t.family} nor Inter is available.`);
    const chosen = options.sort(
      (a, b) =>
        Math.abs(
          (styleWeights[a.fontName.style.toLowerCase().replace(/\s/g, "")] ??
            400) - t.weight,
        ) -
        Math.abs(
          (styleWeights[b.fontName.style.toLowerCase().replace(/\s/g, "")] ??
            400) - t.weight,
        ),
    )[0].fontName;
    if (family !== t.family)
      warnings.push(
        `Font substitution: ${t.family} → ${chosen.family} ${chosen.style}.`,
      );
    return chosen;
  }
  async function build(
    n: DesignNode,
    parent: ChildrenMixin,
    asComponent = false,
  ): Promise<SceneNode> {
    let out:
      | FrameNode
      | ComponentNode
      | InstanceNode
      | RectangleNode
      | TextNode;
    if (n.kind === "instance") {
      const main = components.get(n.componentRef!);
      if (!main) throw new Error("Component is unavailable.");
      const inst = main.createInstance();
      out = inst;
      created.push(inst);
      parent.appendChild(out);
      for (const [path, text] of Object.entries(n.overrides ?? {})) {
        let child: SceneNode = inst;
        for (const part of path.split(".")) {
          if (!("children" in child))
            throw new Error("Invalid instance text path.");
          child = child.children[Number(part)];
          if (!child) throw new Error("Invalid instance text path.");
        }
        if (child.type !== "TEXT")
          throw new Error("Instance overrides must point to text.");
        const current = child.fontName;
        if (typeof current !== "object")
          throw new Error("Mixed fonts are not supported in this experiment.");
        await loadFont(current);
        const property = Object.keys(main.componentPropertyDefinitions).find(
          (key) => key.split("#")[0] === `Text ${path}`,
        );
        if (!property)
          throw new Error("The component has no matching text property.");
        inst.setProperties({ [property]: text });
      }
    } else if (n.kind === "text") {
      const text = api.createText();
      out = text;
      created.push(text);
      const font = fontFor(n);
      await loadFont(font);
      text.fontName = font;
      text.characters = n.text!;
      text.fontSize = n.typography!.size;
      text.lineHeight = { unit: "PIXELS", value: n.typography!.lineHeight };
      text.letterSpacing = {
        unit: "PIXELS",
        value: n.typography!.letterSpacing,
      };
      text.textAlignHorizontal = n.typography!.align.toUpperCase() as
        | "LEFT"
        | "CENTER"
        | "RIGHT";
      text.textAutoResize = "NONE";
      text.fills = paints(n.style.fill);
      parent.appendChild(text);
    } else if (n.kind === "vector") {
      out = api.createNodeFromSvg(n.svg!);
      created.push(out);
      parent.appendChild(out);
    } else if (n.kind === "shape") {
      out = api.createRectangle();
      created.push(out);
      parent.appendChild(out);
    } else {
      out = asComponent ? api.createComponent() : api.createFrame();
      created.push(out);
      parent.appendChild(out);
    }
    out.name = n.name;
    nativeBudget += 1 + ((n.kind === "instance" || n.kind === "vector") && "findAll" in out ? out.findAll().length : 0);
    if(nativeBudget > 8000) throw new Error("Import exceeds the native-layer budget. Simplify the design.");
    out.setPluginData?.("ii-source-id",n.id);
    nodes.set(n.id, out);
    // Append first: FILL is only legal once the parent is an Auto Layout frame.
    out.resize(n.width, n.height);
    out.x = n.x;
    out.y = n.y;
    if (out.type === "TEXT") {
      // DOM Range widths are glyph bounds; Figma's shaping can differ by a
      // fraction of a pixel. Single lines must not unexpectedly wrap midway.
      out.textAutoResize =
        n.height < n.typography!.lineHeight * 1.5
          ? "WIDTH_AND_HEIGHT"
          : "HEIGHT";
      if (out.textAutoResize === "HEIGHT") out.resize(n.width + 2, n.height);
    }
    if (n.kind !== "vector" && n.kind !== "instance") {
      out.fills = paints(n.style.fill);
      out.strokes = paints(n.style.stroke);
      out.strokeWeight = n.style.strokeWidth ?? 0;
      out.strokeAlign = "INSIDE";
      if ("cornerRadius" in out) out.cornerRadius = n.style.radius ?? 0;
    }
    if (n.kind !== "instance") out.opacity = n.style.opacity ?? 1;
    if (n.style.shadow && n.kind !== "instance") {
      const s = n.style.shadow;
      out.effects = [
        {
          type: "DROP_SHADOW",
          color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a },
          offset: { x: s.x, y: s.y },
          radius: s.blur,
          spread: 0,
          visible: true,
          blendMode: "NORMAL",
        },
      ];
    }
    if (
      n.kind === "frame" &&
      (out.type === "FRAME" || out.type === "COMPONENT")
    ) {
      const l = n.layout;
      out.clipsContent = l?.clip ?? false;
      if (l && l.axis !== "none") {
        out.layoutMode = l.axis === "horizontal" ? "HORIZONTAL" : "VERTICAL";
        out.primaryAxisSizingMode = "FIXED";
        out.counterAxisSizingMode = "FIXED";
        [out.paddingTop, out.paddingRight, out.paddingBottom, out.paddingLeft] =
          l.padding;
        out.itemSpacing = l.gap;
        out.counterAxisAlignItems = align[l.align];
        out.primaryAxisAlignItems =
          l.justify === "between" ? "SPACE_BETWEEN" : align[l.justify];
      }
      for (const child of n.children) await build(child, out);
    }
    if ("layoutMode" in parent && parent.layoutMode !== "NONE") {
      if (n.absolute) {
        out.layoutPositioning = "ABSOLUTE";
        out.x = n.x;
        out.y = n.y;
      } else {
        // Match measured sizes, then set explicit flexible intent.
        out.layoutSizingHorizontal =
          n.sizing.width === "hug" &&
          (out.type === "FRAME" || out.type === "COMPONENT") &&
          out.layoutMode !== "NONE"
            ? "HUG"
            : n.sizing.width === "fill"
              ? "FILL"
              : "FIXED";
        out.layoutSizingVertical =
          n.sizing.height === "hug" &&
          (out.type === "FRAME" || out.type === "COMPONENT") &&
          out.layoutMode !== "NONE"
            ? "HUG"
            : n.sizing.height === "fill"
              ? "FILL"
              : "FIXED";
      }
    }
    return out;
  }
  try {
    // Load required fonts before mutating the document. Subsequent text writes
    // reuse these promises; a missing font cannot leave a partial screen.
    const allText: DesignNode[] = [];
    const collect = (n: DesignNode) => { if(n.kind === "text") allText.push(n); n.children.forEach(collect); };
    doc.components.forEach(collect); collect(doc.root);
    await Promise.all(allText.map(n=>loadFont(fontFor(n))));
    for (const [i, definition] of doc.components.entries()) {
      const signature = JSON.stringify(definition);
      let hash = 2166136261;
      for (let j = 0; j < signature.length; j++)
        hash = Math.imul(hash ^ signature.charCodeAt(j), 16777619);
      const marker = `ii-studio-design:v1:${definition.id}:${hash >>> 0}`;
      const existing = api.currentPage.findOne(
        (n) => n.type === "COMPONENT" && n.description === marker && n.getPluginData("ii-definition") === signature && n.getPluginData("ii-native") === nativeSignature(n),
      );
      if (existing?.type === "COMPONENT") {
        components.set(definition.id, existing);
        continue;
      }
      if (!holder) {
        holder = api.createFrame();
        created.push(holder);
        nativeBudget++;
        holder.name = "II studio components";
        holder.fills = [];
        holder.clipsContent = false;
        holder.resize(Math.max(360,...doc.components.map(c=>c.width)), Math.max(300, doc.components.reduce((h,c)=>h+c.height+40,0)));
        holder.x = -500;
        holder.y = 0;
      }
      const component = (await build(
        { ...definition, x: 0, y: doc.components.slice(0,i).reduce((sum,c)=>sum+c.height+40,0) },
        holder!,
        true,
      )) as ComponentNode;
      component.description = marker;
      function expose(node: SceneNode, path: string) {
        if (node.type === "TEXT") {
          const property = component.addComponentProperty(
            `Text ${path}`,
            "TEXT",
            node.characters,
          );
          node.componentPropertyReferences = {
            ...node.componentPropertyReferences,
            characters: property,
          };
        }
        if ("children" in node)
          node.children.forEach((child, index) =>
            expose(child, path ? `${path}.${index}` : String(index)),
          );
      }
      component.children.forEach((child, index) =>
        expose(child, String(index)),
      );
      components.set(definition.id, component);
      const native = nativeSignature(component);
      if(signature.length < 40000 && native.length < 40000) {
        component.setPluginData("ii-definition",signature);
        component.setPluginData("ii-native",native);
      }
    }
    root = await build(doc.root, api.currentPage);
    // The export surface is an artboard, not a transparent layout container.
    // Keep child fills and geometry intact while giving the canvas a white base.
    if (root.type === "FRAME") {
      root.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1 }];
    }
    const existing = api.currentPage.children.filter(
      (n) => n !== root && n !== holder,
    );
    root.x = existing.length
      ? Math.max(...existing.map((n) => n.x + n.width)) + 80
      : 0;
    root.y = 0;
    if (holder) {
      holder.x = root.x - holder.width - 80;
      holder.y = existing.length ? Math.max(...existing.map(n=>n.y+n.height))+80 : root.y;
    }
    api.currentPage.selection = [root];
    api.viewport.scrollAndZoomIntoView([root]);
    const all = [root, ...("findAll" in root ? root.findAll() : [])];
    return {
      rootId: root.id,
      componentHolderId: holder?.id,
      componentIds: Object.fromEntries(
        [...components].map(([id, node]) => [id, node.id]),
      ),
      nativeText: all.filter((n) => n.type === "TEXT").length,
      frames: all.filter((n) => n.type === "FRAME").length,
      autoLayout: all.filter(
        (n) => "layoutMode" in n && n.layoutMode !== "NONE",
      ).length,
      instances: all.filter((n) => n.type === "INSTANCE").length,
      layers: all.length,
      nodeCreationMs: Date.now() - started - validationMs,
      totalImportMs: Date.now() - started,
      validationMs,
      warnings: [...new Set(warnings)],
      ids: Object.fromEntries([...nodes].map(([id, node]) => [id, node.id])),
    };
  } catch (error) {
    // Roll back only this import, including unattached text after font failures.
    for (const node of [...created].reverse()) if (!node.removed) node.remove();
    throw error;
  }
}

import { validateDocument, type DesignDocument, utf8Bytes } from "./contract";

export async function copyDesign(doc: DesignDocument) {
  const json = JSON.stringify(validateDocument(doc));
  if (!navigator.clipboard?.writeText)
    throw new Error(
      "Clipboard unavailable. Download the diagnostic JSON instead.",
    );
  await navigator.clipboard.writeText(json);
  return { bytes: utf8Bytes(json) };
}
export function downloadText(
  text: string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const esc = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
/** Documented SVG/text transfer only. No private Figma clipboard envelope. */
export function designSvg(doc: DesignDocument) {
  validateDocument(doc);
  const rgba = (
    c: { r: number; g: number; b: number; a: number } | undefined,
  ) =>
    c
      ? `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a})`
      : "none";
  function render(n: DesignDocument["root"]): string {
    if (n.kind === "instance")
      throw new Error(
        "Use the independent-frame document for the direct SVG experiment.",
      );
    let content = "";
    if (n.kind === "text") {
      const t = n.typography!;
      content = `<text x="0" y="${t.size}" fill="${rgba(n.style.fill)}" font-family="${esc(t.family)}" font-size="${t.size}" font-weight="${t.weight}" letter-spacing="${t.letterSpacing}">${esc(n.text!)}</text>`;
    } else if (n.kind === "vector") content = n.svg!;
    else
      content = `<rect width="${n.width}" height="${n.height}" rx="${n.style.radius ?? 0}" fill="${rgba(n.style.fill)}" stroke="${rgba(n.style.stroke)}" stroke-width="${n.style.strokeWidth ?? 0}"/>${n.children.map(render).join("")}`;
    return `<g id="${esc(n.id)}" aria-label="${esc(n.name)}" transform="translate(${n.x} ${n.y})" opacity="${n.style.opacity ?? 1}">${content}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.viewport.width}" height="${doc.viewport.height}" viewBox="0 0 ${doc.viewport.width} ${doc.viewport.height}">${render(doc.root)}</svg>`;
}
export async function copySvg(
  doc: DesignDocument,
  format: "plain" | "html" | "svg" = "plain",
) {
  const svg = designSvg(doc);
  if (format === "plain") await navigator.clipboard.writeText(svg);
  else
    await navigator.clipboard.write([
      new ClipboardItem({
        [format === "html" ? "text/html" : "image/svg+xml"]: new Blob([svg], {
          type: format === "html" ? "text/html" : "image/svg+xml",
        }),
      }),
    ]);
}

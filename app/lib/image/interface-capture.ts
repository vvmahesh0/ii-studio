import { captureDimensions } from "./png";

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const visible = (el: Element) => {
  const c = getComputedStyle(el);
  return (
    c.display !== "none" &&
    c.visibility !== "hidden" &&
    el.getBoundingClientRect().width > 0
  );
};
async function readyImages(root: HTMLElement) {
  await Promise.all(
    [...root.querySelectorAll("img")].filter(visible).map(async (img) => {
      if (!img.complete)
        await Promise.race([
          img.decode(),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Some images are still loading. Wait, then try again.",
                  ),
                ),
              5000,
            ),
          ),
        ]);
      if (!img.naturalWidth)
        throw new Error(
          "An image could not be loaded. Remove or replace it before capturing.",
        );
    }),
  );
}
/** Snapshot existing DOM/state, never rerender the program or touch live layout. */
export async function captureInterface(source: HTMLElement): Promise<Blob> {
  if (!source.isConnected || !visible(source))
    throw new Error("Open a completed interface before copying or exporting.");
  if (
    document.querySelector(".iui-popover") &&
    source.querySelector('.iui-popover-trigger[aria-expanded="true"]')
  )
    throw new Error(
      "Close the open popover before capturing this interface. Its floating panel is outside the preview.",
    );
  if (source.querySelector("iframe,video"))
    throw new Error(
      "Embedded video or frame content cannot be captured reliably. Remove it before capturing.",
    );
  await document.fonts.ready;
  await readyImages(source);
  const nodes = [source, ...source.querySelectorAll("*")];
  if (nodes.length > 6000)
    throw new Error(
      "This interface is too large to capture safely. Reduce its content, then try again.",
    );
  const initial = source.getBoundingClientRect();
  captureDimensions(
    initial.width,
    Math.max(source.scrollHeight, initial.height),
  );
  const clone = source.cloneNode(true) as HTMLElement;
  const copies = [clone, ...clone.querySelectorAll("*")];
  const host = document.createElement("div");
  host.className = "studio";
  host.dataset.theme = "light";
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  Object.assign(host.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${initial.width}px`,
    height: "auto",
    minHeight: "0",
    pointerEvents: "none",
    zIndex: "-1",
    display: "block",
    contain: "layout style",
  });
  const inherited = getComputedStyle(source);
  for (const key of inherited)
    if (key.startsWith("--"))
      clone.style.setProperty(key, inherited.getPropertyValue(key));
  for (const key of [
    "font-family",
    "font-size",
    "line-height",
    "color",
    "letter-spacing",
  ])
    clone.style.setProperty(key, inherited.getPropertyValue(key));
  Object.assign(clone.style, {
    width: `${initial.width}px`,
    height: "auto",
    maxHeight: "none",
    minHeight: "0",
    overflow: "visible",
    position: "relative",
    margin: "0",
    transform: "none",
    flex: "none",
  });
  const floating: { source: Element; clone: HTMLElement }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const original = nodes[i],
      copy = copies[i];
    if (
      original instanceof HTMLInputElement &&
      copy instanceof HTMLInputElement
    ) {
      copy.value = original.value;
      copy.setAttribute("value", original.value);
      copy.checked = original.checked;
      copy.toggleAttribute("checked", original.checked);
    } else if (
      original instanceof HTMLTextAreaElement &&
      copy instanceof HTMLTextAreaElement
    ) {
      copy.value = original.value;
      copy.textContent = original.value;
    } else if (
      original instanceof HTMLSelectElement &&
      copy instanceof HTMLSelectElement
    ) {
      [...copy.options].forEach((option, j) => {
        option.selected = original.options[j].selected;
        option.toggleAttribute("selected", option.selected);
      });
    } else if (
      original instanceof HTMLCanvasElement &&
      copy instanceof HTMLCanvasElement
    ) {
      const img = document.createElement("img");
      try {
        img.src = original.toDataURL("image/png");
      } catch {
        throw new Error(
          "A protected canvas cannot be captured. Remove that content before capturing.",
        );
      }
      img.style.cssText = copy.style.cssText;
      img.width = original.width;
      img.height = original.height;
      copy.replaceWith(img);
    }
    if (
      !(original instanceof HTMLElement) ||
      !(copy instanceof HTMLElement) ||
      !visible(original)
    )
      continue;
    const style = getComputedStyle(original);
    copy.style.animation = "none";
    copy.style.transition = "none";
    copy.style.caretColor = "transparent";
    if (style.position === "fixed")
      floating.push({ source: original, clone: copy });
    // Expand vertical scroll regions only. Natural ancestor layout then grows;
    // horizontal carousels keep their current visible page rather than stretching.
    if (
      /auto|scroll|hidden/.test(style.overflowY) &&
      original.scrollHeight > original.clientHeight + 2 &&
      !original.matches("textarea,input,[data-state='closed']")
    ) {
      copy.style.height = `${original.scrollHeight + (original.offsetHeight - original.clientHeight)}px`;
      copy.style.maxHeight = "none";
      copy.style.overflowY = "visible";
      let p = copy.parentElement;
      while (p && p !== clone) {
        p.style.height = "auto";
        p.style.maxHeight = "none";
        p.style.overflowY = "visible";
        p = p.parentElement;
      }
    }
    if (
      original.scrollLeft > 0 &&
      /auto|scroll/.test(style.overflowX) &&
      !original.querySelector("table")
    ) {
      const inner = document.createElement("div");
      Object.assign(inner.style, {
        display: style.display,
        gap: style.gap,
        flexDirection: style.flexDirection,
        alignItems: style.alignItems,
        width: "max-content",
        transform: `translateX(-${original.scrollLeft}px)`,
      });
      while (copy.firstChild) inner.appendChild(copy.firstChild);
      copy.appendChild(inner);
      copy.style.overflowX = "hidden";
    }
    if (
      original.querySelector("table") &&
      original.scrollWidth > original.clientWidth + 2
    )
      copy.style.overflow = "visible";
  }
  // SVG foreignObject capture does not consistently honor 3D backface culling.
  // Flatten the existing visible face only; keep its real styling and content.
  for (const card of clone.querySelectorAll<HTMLElement>(".iui-flashcard")) {
    card.style.perspective = "none";
    const inner = card.querySelector<HTMLElement>(".iui-flashcard-inner");
    if (inner) {
      inner.style.transform = "none";
      inner.style.transformStyle = "flat";
    }
    for (const face of card.querySelectorAll<HTMLElement>(".iui-flashcard-face")) {
      face.style.transform = "none";
      face.style.backfaceVisibility = "visible";
      if (face.getAttribute("aria-hidden") === "true") face.style.display = "none";
    }
  }
  host.appendChild(clone);
  // Native fullscreen only paints descendants of its top-layer element.
  // Keep the offscreen snapshot in that layer so SVG image decoding can finish.
  (document.fullscreenElement ?? document.body).appendChild(host);
  try {
    // Convert preview-owned fixed portals to local absolute layers. Dialogs are
    // centered in the export; outside/body portals are never silently omitted.
    for (const item of floating) {
      const r = item.source.getBoundingClientRect();
      Object.assign(item.clone.style, {
        position: "absolute",
        transform: "none",
        width: `${r.width}px`,
        height: `${r.height}px`,
        top: `${Math.max(0, r.top - initial.top)}px`,
        left: `${Math.max(0, r.left - initial.left)}px`,
      });
      if (
        item.source.matches(
          '[data-slot="dialog-overlay"],[data-slot="drawer-overlay"]',
        )
      )
        Object.assign(item.clone.style, {
          inset: "0",
          width: "100%",
          height: "100%",
        });
      if (item.source.matches('[role="dialog"],[role="alertdialog"]'))
        Object.assign(item.clone.style, {
          left: `${Math.max(16, (initial.width - r.width) / 2)}px`,
          top: "24px",
          height: "auto",
          maxHeight: "none",
        });
    }
    await nextFrame();
    const width = Math.max(initial.width, clone.scrollWidth),
      height = Math.max(
        clone.scrollHeight,
        clone.getBoundingClientRect().height,
      );
    const size = captureDimensions(width, height);
    const { toBlob } = await import("html-to-image");
    const blob = await toBlob(clone, {
      ...size,
      canvasWidth: size.width,
      canvasHeight: size.height,
      backgroundColor: "#ffffff",
      skipAutoScale: true,
      style: {
        width: `${initial.width}px`,
        height: `${height}px`,
        overflow: "visible",
      },
    });
    if (!blob?.size)
      throw new Error(
        "The browser could not create the PNG. Try a smaller interface.",
      );
    return blob;
  } finally {
    host.remove();
  }
}

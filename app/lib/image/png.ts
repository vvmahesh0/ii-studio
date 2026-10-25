/** Shared PNG delivery. This module has no image-rendering dependency. */
export const PNG = "image/png";
export class ClipboardUnavailableError extends Error {}
export function captureDimensions(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1
  )
    throw new Error("There is no visible content to capture.");
  const ratio = Math.min(
    2,
    16384 / width,
    16384 / height,
    Math.sqrt(24_000_000 / (width * height)),
  );
  if (ratio < 1)
    throw new Error(
      "This interface is too large for one PNG. Reduce its content, then try again.",
    );
  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
    pixelRatio: ratio,
  };
}
export function pngFilename(title: string) {
  const base = title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100)
    .replace(/-$/g, "");
  return `${base || "interface"}.png`;
}
export function downloadPng(
  blob: Blob,
  title: string,
  filename = pngFilename(title),
) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
type ClipboardEnvironment = {
  secure: boolean;
  write?: (items: ClipboardItem[]) => Promise<void>;
  Item?: typeof ClipboardItem;
};
/** Start write synchronously within the click, with promised image data. This
 * retains user activation in browsers that reject write after an async capture. */
export async function copyPng(
  prepare: () => Promise<Blob>,
  environment?: ClipboardEnvironment,
) {
  const env = environment ?? {
    secure: window.isSecureContext,
    write: navigator.clipboard?.write?.bind(navigator.clipboard),
    Item: typeof ClipboardItem === "undefined" ? undefined : ClipboardItem,
  };
  if (
    !env.secure ||
    !env.write ||
    !env.Item ||
    (env.Item.supports && !env.Item.supports(PNG))
  )
    throw new ClipboardUnavailableError(
      "This browser cannot copy PNG images. Use Export PNG instead.",
    );
  const image = Promise.resolve().then(prepare);
  let write: Promise<void>;
  try {
    write = env.write([new env.Item({ [PNG]: image })]);
  } catch (e) {
    write = Promise.reject(e);
  }
  // Some browsers leave clipboard writes pending after a fullscreen/focus change.
  // Release the action and offer download instead of leaving the toolbar stuck.
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const boundedWrite = Promise.race([
    write,
    new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error("Clipboard write timed out")), 10000);
    }),
  ]);
  const [captured, copied] = await Promise.allSettled([image, boundedWrite]);
  if (timeout) clearTimeout(timeout);
  if (captured.status === "rejected") throw captured.reason;
  if (copied.status === "rejected")
    throw new ClipboardUnavailableError(
      "Clipboard access was blocked. Allow clipboard access in your browser, or use Export PNG instead.",
    );
}

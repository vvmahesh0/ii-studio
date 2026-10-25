import { importDesign } from "./importer";
import { validateDocument, walk } from "./contract";
import type { PluginAPI } from "../vendor/plugin-api";
declare const __html__: string;
declare const figma: PluginAPI & {
  showUI(
    html: string,
    options: { width: number; height: number; themeColors: boolean; title?: string },
  ): void;
  ui: {
    onmessage: ((message: unknown) => void) | undefined;
    postMessage(message: unknown): void;
  };
  notify(message: string): void;
};
figma.showUI(__html__, { width: 440, height: 256, themeColors: true, title: "II studio" });
let panelHeight = 256;
let busy = false;
const completed = new Map<string, unknown>();
figma.ui.onmessage = async (message) => {
  if (message && typeof message === "object" && "type" in message && message.type === "resize") {
    if (!("height" in message) || typeof message.height !== "number" || !Number.isFinite(message.height)) return;
    const height = Math.max(224, Math.min(640, Math.ceil(message.height)));
    if (height !== panelHeight) {
      panelHeight = height;
      figma.ui.resize(440, height);
    }
    return;
  }
  if (
    !message ||
    typeof message !== "object" ||
    !("type" in message) ||
    !["import", "inspect"].includes(String(message.type)) ||
    !("payload" in message) ||
    typeof message.payload !== "string"
  )
    return;
  const requestId = "requestId" in message && typeof message.requestId === "string" ? message.requestId.slice(0,100) : "legacy";
  const validating = Date.now();
  if (message.type === "import" && busy) return;
  if (message.type === "import" && requestId !== "legacy" && completed.has(requestId)) {
    figma.ui.postMessage(completed.get(requestId)); return;
  }
  try {
    const doc = validateDocument(message.payload);
    const validationMs = Date.now() - validating;
    if (message.type === "inspect") {
      figma.ui.postMessage({ type: "valid", requestId, title: doc.root.name, library: doc.source.library, layers: walk(doc.root).length, warnings: doc.warnings, validationMs }); return;
    }
    busy = true;
    const result = await importDesign(figma, doc);
    const response = { type: "success", requestId, title: doc.root.name, result, validationMs };
    completed.set(requestId,response);
    if(completed.size > 50) completed.delete(completed.keys().next().value!);
    figma.ui.postMessage(response);
    figma.notify("Editable design imported");
  } catch (error) {
    figma.ui.postMessage({
      type: "error",
      requestId,
      message: error && typeof error === "object" && "issues" in error ? "This design contains unsupported or invalid settings. Copy it again from II studio, or update the plugin." : error instanceof Error ? error.message : "Import failed",
    });
  } finally {
    if (message.type === "import") busy = false;
  }
};

export type ModelEvent =
  | { kind: "ready" }
  | { kind: "delta"; text: string }
  | { kind: "complete"; text: string }
  | { kind: "error"; message: string }
  | { kind: "tool" };

/** Decode the documented NDJSON transport without forwarding CLI internals. */
export function decodeModelEvent(value: unknown): ModelEvent | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.event === "init") return { kind: "ready" };
  if (/tool|command|permission|browser/i.test(String(item.event)))
    return { kind: "tool" };
  if (
    item.event === "step_update" &&
    item.step_update &&
    typeof item.step_update === "object"
  ) {
    const step = item.step_update as Record<string, unknown>;
    if (
      /tool|command|permission|question|browser/i.test(String(step.step_type))
    )
      return { kind: "tool" };
    if (
      step.step_type === "agent_response" &&
      typeof step.text_delta === "string"
    )
      return { kind: "delta", text: step.text_delta };
  }
  if (
    item.event === "result" &&
    item.result &&
    typeof item.result === "object"
  ) {
    const result = item.result as Record<string, unknown>;
    if (result.status !== "SUCCESS")
      return {
        kind: "error",
        message: String(result.error ?? "Generation failed"),
      };
    return {
      kind: "complete",
      text: typeof result.response === "string" ? result.response : "",
    };
  }
  return null;
}

export function cleanProgram(text: string): string {
  return text
    .replace(/^\s*```(?:openui(?:-lang)?|oui)?[^\S\n]*\n/i, "")
    .replace(/\n```\s*$/, "")
    .trim();
}

/** An empty layout or a received token is not yet a useful visible widget. */
export function hasUsefulContent(
  value: unknown,
  budget = 300,
  theme: "default" | "modern" = "default",
): boolean {
  if (budget <= 0 || !value || typeof value !== "object") return false;
  if (Array.isArray(value))
    return value.some((part) => hasUsefulContent(part, budget - 1, theme));
  const node = value as { typeName?: string; props?: Record<string, unknown> };
  if (node.typeName && node.props) {
    if (
      [
        "ImagePlaceholder",
        "Title",
        "Text",
        "Caption",
        "Label",
        "Badge",
        "Button",
        ...(theme === "modern"
          ? [
              "AppShell",
              "DashboardSection",
              "AuthLayout",
              "Heading",
              "TextContent",
              "CardHeader",
              "MarkDownRenderer",
              "Alert",
              "Blockquote",
              "CodeBlock",
            ]
          : []),
      ].includes(node.typeName)
    ) {
      const text =
        node.props.text ??
        node.props.label ??
        node.props.title ??
        node.props.code;
      if (typeof text === "string" && text.trim()) return true;
    }
    if (node.typeName === "ImagePlaceholder") return true;
    if (
      theme === "modern" &&
      node.typeName === "MetricCards" &&
      Array.isArray(node.props.items) &&
      node.props.items.some(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof item.label === "string" &&
          item.label.trim() &&
          typeof item.value === "string" &&
          item.value.trim(),
      )
    )
      return true;
    if (
      theme === "modern" &&
      node.typeName === "AuthLayout" &&
      typeof node.props.brand === "string" &&
      node.props.brand.trim()
    )
      return true;
    if (
      node.typeName === "DataList" &&
      Array.isArray(node.props.items) &&
      node.props.items.some(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof item.title === "string" &&
          item.title.trim(),
      )
    )
      return true;
    if (
      node.typeName === "Table" &&
      Array.isArray(node.props.rows) &&
      node.props.rows.length
    )
      return true;
    if (
      [
        "Chart",
        ...(theme === "modern"
          ? [
              "BarChart",
              "LineChart",
              "AreaChart",
              "PieChart",
              "RadarChart",
              "RadialChart",
              "ScatterChart",
            ]
          : []),
      ].includes(node.typeName) &&
      ((Array.isArray(node.props.data) && node.props.data.length) ||
        (Array.isArray(node.props.labels) && node.props.labels.length) ||
        (Array.isArray(node.props.slices) && node.props.slices.length))
    )
      return true;
    return Object.values(node.props).some((part) =>
      hasUsefulContent(part, budget - 1, theme),
    );
  }
  return false;
}

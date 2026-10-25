/** Read a heading from the registered component tree without another AI call. */
export function interfaceTitle(root: unknown): string | null {
  const queue: unknown[] = [root];
  for (let i = 0; i < queue.length && i < 500; i++) {
    const value = queue[i];
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }
    const node = value as {
      typeName?: string;
      props?: Record<string, unknown>;
    };
    if (
      node.props &&
      ["AppShell", "AuthLayout", "Heading", "Title", "CardHeader"].includes(
        node.typeName ?? "",
      )
    ) {
      for (const text of [
        node.props.title,
        node.props.text,
        node.props.label,
      ]) {
        if (typeof text === "string" && text.trim()) return text.trim();
      }
    }
    queue.push(...Object.values(value));
  }
  return null;
}

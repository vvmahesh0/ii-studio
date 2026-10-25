/** Check IDs used as React keys and persisted sidebar selections at completion. */
export function blockConfigurationIssues(root: unknown): string[] {
  const issues: string[] = [];
  let remaining = 3000;
  function unique(values: unknown[], context: string) {
    const seen = new Set<string>();
    for (const value of values) {
      if (typeof value !== "string" || !value.trim()) {
        issues.push(`${context}: every entry needs a nonempty stable id.`);
      } else if (seen.has(value)) {
        issues.push(
          `${context}: duplicate id ${value}. Use unique stable ids.`,
        );
      } else seen.add(value);
    }
  }
  function visit(value: unknown) {
    if (--remaining < 0 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = value as {
      typeName?: string;
      props?: Record<string, unknown>;
    };
    const props = node.props;
    if (
      node.typeName === "AppShell" &&
      props &&
      Array.isArray(props.navigation)
    ) {
      const groups = props.navigation as {
        id?: string;
        items?: { id?: string }[];
      }[];
      unique(
        groups.map((group) => group?.id),
        "AppShell navigation groups",
      );
      unique(
        groups.flatMap((group) => (group?.items ?? []).map((item) => item?.id)),
        "AppShell navigation items",
      );
    }
    if (
      node.typeName === "MetricCards" &&
      props &&
      Array.isArray(props.items)
    ) {
      unique(
        (props.items as { id?: string }[]).map((item) => item?.id),
        "MetricCards items",
      );
    }
    Object.values(value).forEach(visit);
  }
  visit(root);
  return issues;
}

import { z } from "zod";
export const collectionControls = z
  .object({
    search: z.boolean().optional(),
    filterBy: z.array(z.string()).max(6).optional(),
    sort: z.boolean().optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
  })
  .optional();
export type Controls = NonNullable<z.infer<typeof collectionControls>>;
/** Only registered text-bearing cells are indexed; no generated expressions run. */
export function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(cellText).join(" ");
  const item = value as { props?: Record<string, unknown> };
  if (!item.props) return "";
  return ["text", "label", "title", "value", "description", "children"]
    .map((k) => cellText(item.props?.[k]))
    .filter(Boolean)
    .join(" ");
}
export function numericCell(value: unknown) {
  const text = cellText(value)
    .replace(/[,\s$€£₹¥]/g, "")
    .replace("−", "-");
  const match = /^([-+]?\d+(?:\.\d+)?)([kmb%]?)$/i.exec(text);
  return match
    ? Number(match[1]) *
        ({ k: 1e3, m: 1e6, b: 1e9, "%": 1 }[match[2].toLowerCase()] ?? 1)
    : null;
}
export function collectRows(
  rows: unknown[][],
  columns: string[],
  query: string,
  filters: Record<string, string>,
  sort: { column: number; direction: "asc" | "desc" } | null,
) {
  const q = query.trim().toLocaleLowerCase();
  const selected = rows.filter(
    (row) =>
      (!q || row.some((v) => cellText(v).toLocaleLowerCase().includes(q))) &&
      Object.entries(filters).every(
        ([key, value]) =>
          !value || cellText(row[columns.indexOf(key)]) === value,
      ),
  );
  if (!sort) return selected;
  return selected
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const x = a.row[sort.column],
        y = b.row[sort.column],
        nx = numericCell(x),
        ny = numericCell(y);
      const compared =
        nx !== null && ny !== null
          ? nx - ny
          : cellText(x).localeCompare(cellText(y), undefined, {
              numeric: true,
              sensitivity: "base",
            });
      return (
        (sort.direction === "asc" ? compared : -compared) || a.index - b.index
      );
    })
    .map((item) => item.row);
}
export function collectionPage<T>(items: T[], requested: number, size: number) {
  const total = Math.max(1, Math.ceil(items.length / size)),
    page = Math.min(total, Math.max(1, requested));
  return { page, total, items: items.slice((page - 1) * size, page * size) };
}

export type ThemeId = "default" | "modern";
export const themeInfo = {
  default: { label: "Default", revision: "default-v1", root: "Col" },
  modern: { label: "Modern", revision: "modern-v3", root: "Page" },
} as const;
export function isThemeId(value: unknown): value is ThemeId {
  return value === "default" || value === "modern";
}

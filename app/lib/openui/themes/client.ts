"use client";
import type { Library } from "@openuidev/react-lang";
import { library as defaultLibrary } from "../library";
import type { ThemeId } from "./types";
let modern: Promise<Library> | undefined;
export function loadThemeLibrary(theme: ThemeId): Promise<Library> {
  if (theme === "default") return Promise.resolve(defaultLibrary);
  return (modern ??= import("../modern/library")
    .then((m) => m.library)
    .catch((error) => {
      modern = undefined;
      throw error;
    }));
}
export { defaultLibrary };

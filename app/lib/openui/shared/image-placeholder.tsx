"use client";

import { defineComponent } from "@openuidev/react-lang";
import { Image as PictureIcon } from "lucide-react";
import { z } from "zod";

const props = z.object({
  label: z.string().max(120).optional(),
  aspect: z.enum(["landscape", "portrait", "square", "wide", "avatar"]).optional(),
});
const ratios = { landscape: "16 / 9", portrait: "3 / 4", square: "1", wide: "21 / 9", avatar: "1" };

function createPlaceholder(modern: boolean) {
  return defineComponent({
    name: "ImagePlaceholder",
    props,
    description: "Clean local image placeholder. Use whenever a photo, product image, illustration, thumbnail or avatar is requested. Optional contextual label and aspect: landscape (default), portrait, square, wide or avatar. No URL, image search or network request.",
    component: ({ props }) => {
      const aspect = props.aspect ?? "landscape";
      const label = props.label?.trim() || (aspect === "avatar" ? "Avatar" : "Image");
      return <div role="img" aria-label={label} data-ii-placeholder={aspect} style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 10, boxSizing: "border-box", overflow: "hidden", flexShrink: 0,
        width: aspect === "avatar" ? 80 : "100%",
        maxWidth: aspect === "portrait" ? 360 : aspect === "square" ? 480 : undefined,
        aspectRatio: ratios[aspect], padding: aspect === "avatar" ? 12 : 20,
        border: `1px solid ${modern ? "var(--border, #dce5f0)" : "var(--iui-border, #e2e5e1)"}`,
        borderRadius: aspect === "avatar" ? "50%" : modern ? "var(--radius, 10px)" : "var(--iui-radius-lg, 12px)",
        backgroundColor: modern ? "var(--muted, #f5f8fc)" : "var(--iui-surface, #f3f5f1)",
        color: modern ? "var(--muted-foreground, #6a7d96)" : "var(--iui-muted, #687568)",
        fontFamily: "inherit",
      }}>
        <PictureIcon size={aspect === "avatar" ? 24 : 32} strokeWidth={1.3} aria-hidden="true" />
        {aspect !== "avatar" && <span aria-hidden="true" style={{ fontSize: 12, lineHeight: "18px", textAlign: "center", overflowWrap: "anywhere" }}>{label}</span>}
      </div>;
    },
  });
}

export const DefaultImagePlaceholder = createPlaceholder(false);
export const ModernImagePlaceholder = createPlaceholder(true);

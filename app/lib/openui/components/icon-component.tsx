"use client";

import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { Glyph } from "./glyph";
import { color, fg } from "./style";

export const Icon = defineComponent({
  name: "Icon",
  props: z.object({
    name: z.string(),
    size: z.enum(["sm", "md", "lg"]).optional(),
    color: color.optional(),
  }),
  description: "Decorative lucide icon for stats cards and labels. Not a button; no action or variant.",
  component: ({ props }) => (
    <span aria-hidden style={{ display: "inline-flex", flexShrink: 0, color: fg(props.color) }}>
      <Glyph name={props.name} size={{ sm: 16, md: 24, lg: 32 }[props.size ?? "md"]} />
    </span>
  ),
});

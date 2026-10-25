"use client";

import {
  AvatarFallback,
  Avatar as ShadcnAvatar,
} from "@/components/modern/ui/avatar";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";

const AvatarSchema = z.object({
  alt: z.string().optional(),
  fallback: z.string(),
});

export const Avatar = defineComponent({
  name: "Avatar",
  props: AvatarSchema,
  description: "Circular avatar with image and fallback text.",
  component: ({ props }) => (
    <ShadcnAvatar>
      <AvatarFallback>{props.fallback}</AvatarFallback>
    </ShadcnAvatar>
  ),
});

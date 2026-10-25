"use client";

import { Progress as ShadcnProgress } from "@/components/modern/ui/progress";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";

const ProgressSchema = z.object({
  value: z.number().min(0).max(100),
  label: z.string().optional(),
  showValue: z.boolean().optional(),
});

export const Progress = defineComponent({
  name: "Progress",
  props: ProgressSchema,
  description:
    "Progress(value, label, showValue). Completion percentage only, not a flight path or duration. showValue defaults true; false hides the printed percentage.",
  component: ({ props }) => (
    <div className="flex flex-col gap-1">
      {props.label && (
        <div className="flex justify-between gap-3 text-sm">
          <span className="min-w-0">{props.label}</span>
          {props.showValue !== false && <span className="shrink-0 text-muted-foreground">{props.value}%</span>}
        </div>
      )}
      <ShadcnProgress value={props.value} aria-label={props.label ?? "Completion"} />
    </div>
  ),
});

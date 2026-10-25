"use client";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";
import { ContentChildUnion } from "../unions";
import { Buttons } from "../components/buttons";

export const DashboardSection = defineComponent({
  name: "DashboardSection",
  props: z.object({
    children: z.array(ContentChildUnion),
    title: z.string().optional(),
    description: z.string().optional(),
    actions: z.optional(Buttons.ref),
  }),
  description:
    "DashboardSection(children, title, description, actions). Flexible dashboard section with optional compact heading, supporting description and Buttons action group. Children can be charts, tables, forms or any registered content. No forced outer card. Also works outside AppShell.",
  component: function DashboardSectionView({ props, renderNode }) {
    return (
      <section className="flex min-w-0 flex-col gap-4">
        {(props.title || props.description || props.actions) && (
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {props.title && (
                <h2 className="text-base font-semibold">{props.title}</h2>
              )}
              {props.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {props.description}
                </p>
              )}
            </div>
            {props.actions && renderNode(props.actions)}
          </div>
        )}
        {renderNode(props.children)}
      </section>
    );
  },
});

"use client";

import { Calendar } from "@/components/modern/ui/calendar";
import { defineComponent, useStateField } from "@openuidev/react-lang";
import { z } from "zod";

const CalendarBlockSchema = z.object({
  mode: z.enum(["single", "multiple", "range"]).optional(),
  defaultMonth: z.string().optional(),
  numberOfMonths: z.number().optional(),
  captionLayout: z.enum(["label", "dropdown"]).optional(),
});

export const CalendarBlock = defineComponent({
  name: "CalendarBlock",
  props: CalendarBlockSchema,
  description:
    'Standalone calendar display. mode: "single" | "multiple" | "range". captionLayout: "label" | "dropdown" (default "dropdown"). numberOfMonths defaults to 1.',
  component: function CalendarBlockView({ props, statementId }) {
    const id = statementId ?? "calendar";
    const single = useStateField<string | null>(`${id}:single`, null);
    const multiple = useStateField<string[]>(`${id}:multiple`, []);
    const rangeField = useStateField<{ from: string; to?: string } | null>(
      `${id}:range`,
      null,
    );
    const toDate = (value: string | null | undefined) => {
      if (!value) return undefined;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? undefined : date;
    };
    const selected = toDate(single.value);
    const multiSelected = multiple.value
      .map(toDate)
      .filter((date): date is Date => !!date);
    const savedRange = rangeField.value;
    const range = savedRange
      ? { from: toDate(savedRange.from)!, to: toDate(savedRange.to) }
      : undefined;

    const mode = props.mode ?? "single";
    const numberOfMonths = Math.min(3, Math.max(1, props.numberOfMonths ?? 1));
    const captionLayout = props.captionLayout ?? "dropdown";
    const defaultMonth = toDate(props.defaultMonth);

    const common = {
      numberOfMonths,
      defaultMonth,
      captionLayout,
      className: "rounded-lg border",
    };

    if (mode === "range") {
      return (
        <Calendar
          mode="range"
          selected={range}
          onSelect={(r) =>
            rangeField.setValue(
              r?.from
                ? { from: r.from.toISOString(), to: r.to?.toISOString() }
                : null,
            )
          }
          {...common}
        />
      );
    }

    if (mode === "multiple") {
      return (
        <Calendar
          mode="multiple"
          selected={multiSelected}
          onSelect={(d) =>
            multiple.setValue((d ?? []).map((date) => date.toISOString()))
          }
          {...common}
        />
      );
    }

    return (
      <Calendar
        mode="single"
        selected={selected}
        onSelect={(d) => single.setValue(d?.toISOString() ?? null)}
        {...common}
      />
    );
  },
});

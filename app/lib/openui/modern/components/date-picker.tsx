"use client";

import { Button as ShadcnButton } from "@/components/modern/ui/button";
import { Calendar } from "@/components/modern/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/modern/ui/popover";
import {
  defineComponent,
  useFormName,
  useIsStreaming,
  useSetFieldValue,
} from "@openuidev/react-lang";
import { cn } from "cn";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useModernField } from "../../local/local-form";
import { z } from "zod";

const DatePickerSchema = z.object({
  name: z.string(),
  placeholder: z.string().optional(),
});

export const DatePicker = defineComponent({
  name: "DatePicker",
  props: DatePickerSchema,
  description: "Date selection input with calendar popover.",
  component: function DatePickerView({ props }) {
    const formName = useFormName();
    const setFieldValue = useSetFieldValue();
    const isStreaming = useIsStreaming();

    const fieldName = props.name as string;
    const saved = useModernField(fieldName, "DatePicker", "") as string;
    const parsedDate = saved ? new Date(saved) : undefined;
    const date =
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate
        : undefined;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <ShadcnButton
            variant="outline"
            id={`${formName ?? "preview"}-${fieldName}`}
            className={cn(
              "w-full justify-start text-left",
              !date && "text-muted-foreground",
            )}
            disabled={isStreaming}
          >
            <CalendarIcon data-icon="inline-start" />
            {date ? format(date, "PPP") : (props.placeholder ?? "Pick a date")}
          </ShadcnButton>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              if (d) {
                setFieldValue(
                  formName,
                  "DatePicker",
                  fieldName,
                  d.toISOString(),
                  true,
                );
              }
            }}
          />
        </PopoverContent>
      </Popover>
    );
  },
});

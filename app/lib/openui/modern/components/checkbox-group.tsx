"use client";

import { Checkbox } from "@/components/modern/ui/checkbox";
import { Label as ShadcnLabel } from "@/components/modern/ui/label";
import {
  defineComponent,
  useFormName,
  useIsStreaming,
  useSetFieldValue,
} from "@openuidev/react-lang";
import { rulesSchema } from "../rules";
import { useFieldRules } from "../../local/local-form";
import { useModernField } from "../../local/local-form";
import { z } from "zod";

const CheckBoxItemSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const CheckBoxItem = defineComponent({
  name: "CheckBoxItem",
  props: CheckBoxItemSchema,
  description: "Option in a CheckBoxGroup.",
  component: () => null,
});

const CheckBoxGroupSchema = z.object({
  name: z.string(),
  items: z.array(CheckBoxItem.ref),
  rules: rulesSchema,
});

export const CheckBoxGroup = defineComponent({
  name: "CheckBoxGroup",
  props: CheckBoxGroupSchema,
  description: "Multiple checkbox options. items: CheckBoxItem[].",
  component: function CheckboxGroupView({ props }) {
    const formName = useFormName();
    const setFieldValue = useSetFieldValue();
    const isStreaming = useIsStreaming();

    const fieldName = props.name as string;
    const current = useModernField(fieldName, "CheckBoxGroup", []) as string[];
    useFieldRules(fieldName, current, props.rules);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = ((props.items ?? []) as any[]).filter(
      (item) => item?.props?.value,
    );

    return (
      <div className="flex flex-col gap-2">
        {items.map((item, i) => {
          const val = item.props.value as string;
          const checked = current.includes(val);
          return (
            <div key={i} className="flex items-center gap-2">
              <Checkbox
                id={`${fieldName}-${val}`}
                checked={checked}
                onCheckedChange={(c) => {
                  const next = c
                    ? [...current, val]
                    : current.filter((v: string) => v !== val);
                  setFieldValue(
                    formName,
                    "CheckBoxGroup",
                    fieldName,
                    next,
                    true,
                  );
                }}
                disabled={isStreaming}
              />
              <ShadcnLabel htmlFor={`${fieldName}-${val}`}>
                {item.props.label || val}
              </ShadcnLabel>
            </div>
          );
        })}
      </div>
    );
  },
});

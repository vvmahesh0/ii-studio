"use client";

import { Label as ShadcnLabel } from "@/components/modern/ui/label";
import {
  RadioGroupItem,
  RadioGroup as ShadcnRadioGroup,
} from "@/components/modern/ui/radio-group";
import {
  defineComponent,
  useFormName,
  useIsStreaming,
  useSetFieldValue,
} from "@openuidev/react-lang";
import { useModernField } from "../../local/local-form";
import { z } from "zod";

const RadioItemSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const RadioItem = defineComponent({
  name: "RadioItem",
  props: RadioItemSchema,
  description: "Option in a RadioGroup.",
  component: () => null,
});

const RadioGroupSchema = z.object({
  name: z.string(),
  items: z.array(RadioItem.ref),
});

export const RadioGroup = defineComponent({
  name: "RadioGroup",
  props: RadioGroupSchema,
  description: "Radio selection group. items: RadioItem[].",
  component: function RadioGroupView({ props }) {
    const formName = useFormName();
    const setFieldValue = useSetFieldValue();
    const isStreaming = useIsStreaming();

    const fieldName = props.name as string;
    const value = useModernField(fieldName, "RadioGroup", "") as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = ((props.items ?? []) as any[]).filter(
      (item) => item?.props?.value,
    );

    return (
      <ShadcnRadioGroup
        value={value}
        onValueChange={(val) => {
          setFieldValue(formName, "RadioGroup", fieldName, val, true);
        }}
        disabled={isStreaming}
      >
        {items.map((item, i) => {
          const val = item.props.value as string;
          return (
            <div key={i} className="flex items-center gap-2">
              <RadioGroupItem value={val} id={`${fieldName}-${val}`} />
              <ShadcnLabel htmlFor={`${fieldName}-${val}`}>
                {item.props.label || val}
              </ShadcnLabel>
            </div>
          );
        })}
      </ShadcnRadioGroup>
    );
  },
});

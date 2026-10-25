"use client";

import { Slider as ShadcnSlider } from "@/components/modern/ui/slider";
import {
  defineComponent,
  useFormName,
  useIsStreaming,
  useSetFieldValue,
} from "@openuidev/react-lang";
import { useModernField } from "../../local/local-form";
import { z } from "zod";

const SliderSchema = z.object({
  name: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  defaultValue: z.number().optional(),
});

export const Slider = defineComponent({
  name: "Slider",
  props: SliderSchema,
  description: "Range slider input. min, max, step, defaultValue.",
  component: function SliderView({ props }) {
    const formName = useFormName();
    const setFieldValue = useSetFieldValue();
    const isStreaming = useIsStreaming();

    const fieldName = props.name as string;
    const saved = useModernField(
      fieldName,
      "Slider",
      props.defaultValue ?? props.min ?? 0,
    ) as number;
    const val = saved ?? props.defaultValue ?? props.min ?? 0;

    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span>{fieldName}</span>
          <span className="text-muted-foreground">{val}</span>
        </div>
        <ShadcnSlider
          min={props.min ?? 0}
          max={props.max ?? 100}
          step={props.step ?? 1}
          value={[val]}
          onValueChange={([v]) => {
            setFieldValue(formName, "Slider", fieldName, v, true);
          }}
          disabled={isStreaming}
        />
      </div>
    );
  },
});

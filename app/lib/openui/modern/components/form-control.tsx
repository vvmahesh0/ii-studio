"use client";
import { Field, FieldLabel, FieldError } from "@/components/modern/ui/field";
import {
  defineComponent,
  useFormName,
  useFormValidation,
} from "@openuidev/react-lang";
import { z } from "zod";
export const FormControl = defineComponent({
  name: "FormControl",
  props: z.object({ label: z.string(), field: z.any() }),
  description: "Labels a named field and shows local validation errors.",
  component: function FormControlView({ props, renderNode }) {
    const formName = useFormName();
    const validation = useFormValidation();
    const field = props.field as { props?: { name?: string } };
    const name = field?.props?.name;
    const error = name ? validation?.errors?.[name] : undefined;
    return (
      <Field data-invalid={!!error}>
        <FieldLabel
          htmlFor={name ? `${formName ?? "preview"}-${name}` : undefined}
        >
          {props.label}
        </FieldLabel>
        {renderNode(props.field)}
        {error && (
          <FieldError id={`${formName ?? "preview"}-${name}-error`}>
            {error}
          </FieldError>
        )}
      </Field>
    );
  },
});

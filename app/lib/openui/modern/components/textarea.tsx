"use client";

import { Textarea as ShadcnTextarea } from "@/components/modern/ui/textarea";
import {
  defineComponent,
  parseStructuredRules,
  useFormName,
  useFormValidation,
  useGetFieldValue,
  useIsStreaming,
  useSetFieldValue,
} from "@openuidev/react-lang";
import React from "react";
import { useModernField } from "../../local/local-form";
import { z } from "zod";
import { rulesSchema } from "../rules";

const TextareaSchema = z.object({
  name: z.string(),
  placeholder: z.string().optional(),
  rows: z.number().optional(),
  rules: rulesSchema,
});

export const TextArea = defineComponent({
  name: "TextArea",
  props: TextareaSchema,
  description:
    "Multi-line text input. rows sets visible height. rules for validation.",
  component: function TextareaView({ props }) {
    const formName = useFormName();
    const getFieldValue = useGetFieldValue();
    const setFieldValue = useSetFieldValue();
    const isStreaming = useIsStreaming();
    const formValidation = useFormValidation();

    const fieldName = props.name as string;
    const rules = React.useMemo(
      () => parseStructuredRules(props.rules),
      [props.rules],
    );
    const savedValue = useModernField(fieldName, "TextArea", "");

    React.useEffect(() => {
      if (!isStreaming && rules.length > 0 && formValidation) {
        formValidation.registerField(fieldName, rules, () =>
          getFieldValue(formName, fieldName),
        );
        return () => formValidation.unregisterField(fieldName);
      }
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isStreaming, rules.length > 0]);

    return (
      <ShadcnTextarea
        name={fieldName}
        aria-invalid={!!formValidation?.errors?.[fieldName]}
        aria-describedby={
          formValidation?.errors?.[fieldName]
            ? `${formName ?? "preview"}-${fieldName}-error`
            : undefined
        }
        placeholder={props.placeholder}
        rows={props.rows ?? 3}
        id={`${formName ?? "preview"}-${fieldName}`}
        value={savedValue as string}
        onChange={(e) =>
          setFieldValue(formName, "TextArea", fieldName, e.target.value, true)
        }
        onBlur={(e) => {
          const val = e.target.value;
          if (val !== savedValue)
            setFieldValue(formName, "TextArea", fieldName, val, true);
          if (rules.length > 0 && formValidation)
            formValidation.validateField(fieldName, val, rules);
        }}
        disabled={isStreaming}
      />
    );
  },
});

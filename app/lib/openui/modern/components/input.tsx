"use client";

import { Input as ShadcnInput } from "@/components/modern/ui/input";
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

const InputSchema = z.object({
  name: z.string(),
  placeholder: z.string().optional(),
  type: z.enum(["text", "email", "password", "number", "url"]).optional(),
  rules: rulesSchema,
});

export const Input = defineComponent({
  name: "Input",
  props: InputSchema,
  description:
    'Text input field. type: "text" | "email" | "password" | "number" | "url". rules for validation.',
  component: function InputView({ props }) {
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
    const savedValue = useModernField(fieldName, "Input", "");

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
      <ShadcnInput
        name={fieldName}
        aria-invalid={!!formValidation?.errors?.[fieldName]}
        aria-describedby={
          formValidation?.errors?.[fieldName]
            ? `${formName ?? "preview"}-${fieldName}-error`
            : undefined
        }
        placeholder={props.placeholder}
        type={props.type ?? "text"}
        id={`${formName ?? "preview"}-${fieldName}`}
        value={savedValue as string}
        onChange={(e) =>
          setFieldValue(formName, "Input", fieldName, e.target.value, true)
        }
        onBlur={(e) => {
          const val = e.target.value;
          if (val !== savedValue)
            setFieldValue(formName, "Input", fieldName, val, true);
          if (rules.length > 0 && formValidation)
            formValidation.validateField(fieldName, val, rules);
        }}
        disabled={isStreaming}
      />
    );
  },
});

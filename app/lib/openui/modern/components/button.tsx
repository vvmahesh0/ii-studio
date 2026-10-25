"use client";

import { Button as ShadcnButton } from "@/components/modern/ui/button";
import {
  BuiltinActionType,
  defineComponent,
  useFormName,
  useFormValidation,
  useIsStreaming,
  useTriggerAction,
} from "@openuidev/react-lang";
import { useContext } from "react";
import { LocalFormContext } from "../../local/local-form";
import { z } from "zod";
import { actionSchema, type ActionSchema } from "../action";

const ButtonSchema = z.object({
  label: z.string(),

  action: actionSchema,
  variant: z
    .enum(["default", "destructive", "outline", "secondary", "ghost", "link"])
    .optional(),
  size: z.enum(["default", "xs", "sm", "lg", "icon"]).optional(),
  behavior: z.enum(["submit", "reset"]).optional(),
});

export const Button = defineComponent({
  name: "Button",
  props: ButtonSchema,
  description:
    'Clickable button. variant: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link". size: "default" | "xs" | "sm" | "lg" | "icon". Optional fifth behavior submit/reset validates or resets local form fields; no backend.',
  component: function ButtonView({ props }) {
    const localForm = useContext(LocalFormContext);
    const triggerAction = useTriggerAction();
    const formName = useFormName();
    const formValidation = useFormValidation();
    const isStreaming = useIsStreaming();

    const label = String(props.label ?? "");
    const action = props.action as ActionSchema;
    const variant = props.variant ?? "default";
    const size = props.size ?? "default";

    return (
      <ShadcnButton
        variant={variant}
        size={size}
        disabled={isStreaming}
        onClick={() => {
          const behavior =
            props.behavior ??
            (/^reset(?: form| values)?$/i.test(label.trim())
              ? "reset"
              : undefined);
          if (localForm && behavior === "reset") return localForm.reset();
          if (localForm && (behavior === "submit" || variant === "default")) {
            localForm.submit();
            return;
          }
          const actionType =
            action?.type ?? BuiltinActionType.ContinueConversation;
          if (
            formValidation &&
            variant === "default" &&
            actionType === BuiltinActionType.ContinueConversation
          ) {
            const valid = formValidation.validateForm();
            if (!valid) return;
          }
          void triggerAction(label, formName, {
            type: BuiltinActionType.ContinueConversation,
          });
        }}
      >
        {label}
      </ShadcnButton>
    );
  },
});

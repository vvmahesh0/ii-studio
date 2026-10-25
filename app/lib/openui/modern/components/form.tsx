"use client";

import {
  FormNameContext,
  FormValidationContext,
  defineComponent,
  useCreateFormValidation,
} from "@openuidev/react-lang";
import { FieldGroup } from "@/components/modern/ui/field";
import { z } from "zod";
import { LocalForm, defaultsSchema } from "../../local/local-form";
import { Buttons } from "./buttons";
import { FormControl } from "./form-control";

const FormSchema = z.object({
  name: z.string(),
  buttons: Buttons.ref,
  fields: z.array(FormControl.ref).default([]),
  columns: z.number().int().min(1).max(6).optional(),
  defaults: defaultsSchema,
});

export const Form = defineComponent({
  name: "Form",
  props: FormSchema,
  description:
    "Form(name, buttons, fields, columns). Optional columns (1-6) arranges fields in a responsive equal-width grid; default 1. Optional fifth defaults object sets initial values by field name. Use 2-4 for compact desktop search/filter forms. Buttons remain below the fields.",
  component: function FormView({ props, renderNode }) {
    const formValidation = useCreateFormValidation();
    const formName = props.name as string;
    const columns = Math.max(1, Math.min(6, props.columns ?? 1));

    return (
      <FormValidationContext.Provider value={formValidation}>
        <FormNameContext.Provider value={formName}>
          <LocalForm defaults={props.defaults}>
            <div role="form" className="flex flex-col gap-4">
              <FieldGroup
                className="grid min-w-0 gap-4"
                style={{
                  gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, max(180px, (100% - ${(columns - 1) * 16}px) / ${columns})), 1fr))`,
                }}
              >
                {renderNode(props.fields)}
              </FieldGroup>
              {renderNode(props.buttons)}
            </div>
          </LocalForm>
        </FormNameContext.Provider>
      </FormValidationContext.Provider>
    );
  },
});

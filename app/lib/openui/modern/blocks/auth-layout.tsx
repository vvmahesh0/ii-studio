"use client";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";
import { LayoutGrid } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/modern/ui/card";
import { ContentChildUnion } from "../unions";

export const AuthLayout = defineComponent({
  name: "AuthLayout",
  props: z.object({
    mode: z.enum(["login", "signup"]),
    brand: z.string(),
    children: z.array(ContentChildUnion),
    title: z.string().optional(),
    description: z.string().optional(),
    supportingText: z.string().optional(),
  }),
  description:
    "AuthLayout(mode, brand, children, title, description, supportingText). Centered login/signup layout adapted from shadcn. children should contain one existing Form, not another Card/AuthLayout. mode login/signup sets default title. Content remains configurable. No actual authentication, OAuth, network submission or external links.",
  component: function AuthLayoutView({ props, renderNode }) {
    return (
      <div className="ii-auth-layout">
        <div className="flex w-full max-w-md flex-col gap-5">
          {props.brand && (
            <div className="flex items-center justify-center gap-2 text-base font-semibold">
              <LayoutGrid className="size-5 text-primary" aria-hidden />
              {props.brand}
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>
                {props.title ??
                  (props.mode === "signup"
                    ? "Create an account"
                    : "Welcome back")}
              </CardTitle>
              {props.description && (
                <CardDescription>{props.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>{renderNode(props.children)}</CardContent>
            {props.supportingText && (
              <CardFooter>
                <p className="w-full text-center text-xs text-muted-foreground">
                  {props.supportingText}
                </p>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    );
  },
});

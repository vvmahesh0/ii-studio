"use client";

import {
  Tabs as ShadcnTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/modern/ui/tabs";
import { defineComponent, useStateField } from "@openuidev/react-lang";
import { z } from "zod";
import { ContentChildUnion } from "../unions";

const TabItemSchema = z.object({
  value: z.string(),
  trigger: z.string(),
  content: z.array(ContentChildUnion),
});

export const TabItem = defineComponent({
  name: "TabItem",
  props: TabItemSchema,
  description:
    "Tab panel. value: unique id, trigger: tab label, content: children.",
  component: () => null,
});

const TabsSchema = z.object({
  items: z.array(TabItem.ref),
  defaultValue: z.string().optional(),
});

export const Tabs = defineComponent({
  name: "Tabs",
  props: TabsSchema,
  description:
    "Tabbed content. items: TabItem[]. defaultValue: initially active tab.",
  component: function TabsView({ props, renderNode, statementId }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawItems = (props.items ?? []) as any[];

    const items = rawItems.filter(
      (item) => item?.props?.value != null && item?.props?.trigger != null,
    );

    const selectedField = useStateField<string | null>(
      `tabs:${statementId ?? "tabs"}`,
      null,
    );
    const userSelected =
      typeof selectedField.value === "string" ? selectedField.value : null;
    const setUserSelected = (value: string) => selectedField.setValue(value);

    const firstValue = items[0]?.props?.value as string | undefined;
    const preferredDefault = props.defaultValue ?? firstValue;

    const userSelectionValid =
      userSelected != null &&
      items.some((item) => String(item?.props?.value) === userSelected);
    const activeTab = userSelectionValid
      ? userSelected
      : (preferredDefault ?? "");

    if (items.length === 0) return null;

    return (
      <ShadcnTabs value={activeTab} onValueChange={setUserSelected}>
        <TabsList>
          {items.map((item) => {
            const val = String(item.props.value);
            return (
              <TabsTrigger key={val} value={val}>
                {String(item.props.trigger)}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {items.map((item) => {
          const val = String(item.props.value);
          return (
            <TabsContent key={val} value={val} className="flex flex-col gap-3">
              {renderNode(item.props.content)}
            </TabsContent>
          );
        })}
      </ShadcnTabs>
    );
  },
});

"use client";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";
import { cn } from "cn";
import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
  CardFooter,
} from "@/components/modern/ui/card";
import { Badge } from "@/components/modern/ui/badge";
import { metricItem, type MetricItem } from "./schemas";

export const MetricCards = defineComponent({
  name: "MetricCards",
  props: z.object({
    items: z.array(metricItem),
    highlightedId: z.string().optional(),
  }),
  description:
    "MetricCards(items, highlightedId). Responsive dashboard KPI cards. items are [{id,label,value,description?,trend?}], unique stable ids, string values; preserves item count. highlightedId optionally gives exactly one item an accent surface. Not a generic pricing/result card; use Card for custom content.",
  component: function MetricCardsView({ props }) {
    const items = ((props.items ?? []) as MetricItem[]).filter(
      (item) => item && item.id && item.label && typeof item.value === "string",
    );
    const highlighted = items.findIndex(
      (item) => item.id === props.highlightedId,
    );
    return (
      <div className="ii-metric-cards">
        {items.map((item, index) => (
          <Card
            key={item.id}
            className={cn("min-w-0", index === highlighted && "ii-card-accent")}
          >
            <CardHeader>
              <CardDescription>{item.label}</CardDescription>
              <CardTitle>
                <span className="ii-metric-value">{item.value}</span>
              </CardTitle>
            </CardHeader>
            {(item.trend || item.description) && (
              <CardFooter className="flex-wrap items-start gap-2">
                {item.trend && <Badge variant="secondary">{item.trend}</Badge>}
                {item.description && (
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    );
  },
});

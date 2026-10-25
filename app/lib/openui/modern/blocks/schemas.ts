import { z } from "zod";

export const navigationItem = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().optional(),
});
export const navigationGroup = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  items: z.array(navigationItem),
});
export const metricItem = z.object({
  id: z.string().min(1),
  label: z.string(),
  value: z.string(),
  description: z.string().optional(),
  trend: z.string().optional(),
});
export type NavigationGroup = z.infer<typeof navigationGroup>;
export type MetricItem = z.infer<typeof metricItem>;

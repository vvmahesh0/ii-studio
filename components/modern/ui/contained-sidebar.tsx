"use client";

// Adapted from shadcn/ui sidebar primitives (MIT). This subset deliberately
// omits viewport positioning, cookies, global shortcuts and tooltip providers.
import type { ComponentProps } from "react";
import { cn } from "cn";

export function ContainedSidebar({
  className,
  ...props
}: ComponentProps<"aside">) {
  return (
    <aside
      data-slot="sidebar"
      className={cn(
        "ii-block-sidebar flex min-w-0 flex-col border-r",
        className,
      )}
      {...props}
    />
  );
}
export function SidebarGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn(
        "relative flex w-full min-w-0 flex-col gap-2 p-2",
        className,
      )}
      {...props}
    />
  );
}
export function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
}
export function SidebarMenuButton({
  active = false,
  className,
  ...props
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-slot="sidebar-menu-button"
      data-active={active}
      aria-current={active ? "page" : undefined}
      className={cn(
        "ii-block-nav-button flex min-h-9 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

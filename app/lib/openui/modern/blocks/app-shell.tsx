"use client";

import {
  defineComponent,
  useIsStreaming,
  useStateField,
} from "@openuidev/react-lang";
import { PanelLeftClose, PanelLeftOpen, LayoutGrid } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/modern/ui/button";
import { Avatar, AvatarFallback } from "@/components/modern/ui/avatar";
import {
  ContainedSidebar,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
} from "@/components/modern/ui/contained-sidebar";
import { Glyph } from "../../components/glyph";
import { ContentChildUnion } from "../unions";
import { navigationGroup, type NavigationGroup } from "./schemas";

export const AppShell = defineComponent({
  name: "AppShell",
  props: z.object({
    brand: z.string(),
    navigation: z.array(navigationGroup),
    title: z.string(),
    children: z.array(ContentChildUnion),
    user: z
      .object({ name: z.string(), detail: z.string().optional() })
      .optional(),
  }),
  description:
    "AppShell(brand, navigation, title, children, user). Contained desktop sidebar + page header + flexible content. navigation is [{id,label,items:[{id,label,icon}]}], unique stable group/item ids; icons are lucide names. user is optional {name,detail}. Local selection/collapse only; does not change page content. Put directly inside Page, never nest shells.",
  component: function AppShellView({ props, renderNode, statementId }) {
    const collapsed = useStateField<boolean>(
      `shell:${statementId}:collapsed`,
      false,
    );
    const selection = useStateField<string>(
      `shell:${statementId}:selection`,
      "",
    );
    const streaming = useIsStreaming();
    // A definition may arrive before every array entry is complete.
    const groups = ((props.navigation ?? []) as NavigationGroup[]).filter(
      (g) => g && typeof g.id === "string",
    );
    const items = groups.flatMap((g) =>
      (g.items ?? []).filter((i) => i && i.id && i.label),
    );
    const activeId = items.some((i) => i.id === selection.value)
      ? selection.value
      : items[0]?.id;
    const isCollapsed = collapsed.value === true;
    const user = props.user as { name?: string; detail?: string } | undefined;
    const initials = (user?.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("");
    return (
      <div className="ii-app-shell" data-collapsed={isCollapsed}>
        <ContainedSidebar
          aria-label={`${props.brand || "Application"} navigation`}
        >
          <div className="flex min-h-16 items-center gap-2 border-b px-3">
            <LayoutGrid className="size-5 shrink-0 text-primary" aria-hidden />
            <strong className="ii-shell-label truncate" title={props.brand}>
              {props.brand}
            </strong>
          </div>
          <nav className="flex-1 py-2" aria-label="App navigation">
            {groups.map((group) => (
              <SidebarGroup key={group.id}>
                {group.label && (
                  <div
                    className="ii-shell-label truncate px-2 text-xs font-medium text-muted-foreground"
                    title={group.label}
                  >
                    {group.label}
                  </div>
                )}
                <SidebarMenu>
                  {(group.items ?? [])
                    .filter((i) => i && i.id && i.label)
                    .map((item) => (
                      <li key={item.id}>
                        <SidebarMenuButton
                          active={item.id === activeId}
                          disabled={streaming}
                          aria-label={item.label}
                          title={item.label}
                          onClick={() => selection.setValue(item.id)}
                        >
                          <span
                            className="inline-flex size-5 shrink-0 items-center justify-center"
                            aria-hidden
                          >
                            {item.icon ? (
                              <Glyph name={item.icon} size={18} />
                            ) : (
                              <LayoutGrid className="size-4" />
                            )}
                          </span>
                          <span className="ii-shell-label truncate">
                            {item.label}
                          </span>
                        </SidebarMenuButton>
                      </li>
                    ))}
                </SidebarMenu>
              </SidebarGroup>
            ))}
          </nav>
          {user?.name && (
            <div className="flex min-w-0 items-center gap-2 border-t p-3">
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="ii-shell-label min-w-0">
                <div className="truncate text-sm font-medium" title={user.name}>
                  {user.name}
                </div>
                {user.detail && (
                  <div
                    className="truncate text-xs text-muted-foreground"
                    title={user.detail}
                  >
                    {user.detail}
                  </div>
                )}
              </div>
            </div>
          )}
        </ContainedSidebar>
        <div className="min-w-0">
          <header className="flex min-h-16 items-center gap-3 border-b px-5 py-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isCollapsed}
              disabled={streaming}
              onClick={() => collapsed.setValue(!isCollapsed)}
            >
              {isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
            <h1 className="min-w-0 text-xl font-semibold tracking-tight">
              {props.title}
            </h1>
          </header>
          <div className="ii-shell-content flex min-w-0 flex-col gap-6 p-5">
            {renderNode(props.children)}
          </div>
        </div>
      </div>
    );
  },
});

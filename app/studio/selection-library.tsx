"use client";
import {
  cloneElement,
  isValidElement,
  Fragment,
  type ReactNode,
  type ReactElement,
} from "react";
import type { Library, ComponentRenderProps } from "@openuidev/react-lang";

const cache = new WeakMap<Library, Library>();
/** Tag actual roots; no DOM wrappers, dimensions or CSS changes. Composite roots
 * in our local libraries forward data attributes. Non-rendering schema helpers
 * remain unselectable. Inline components receive source IDs from normalization.
 */
function tag(node: ReactNode, id: string, type: string): ReactNode {
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<Record<string, unknown>>;
  if (
    el.type === Fragment ||
    (typeof el.type === "object" &&
      String((el.type as unknown as { $$typeof?: symbol }).$$typeof).includes(
        "context",
      ))
  )
    return cloneElement(
      el,
      {},
      Array.isArray(el.props.children)
        ? el.props.children.map((child) => tag(child, id, type))
        : tag(el.props.children as ReactNode, id, type),
    );
  return cloneElement(el, {
    "data-ii-selection": id,
    "data-ii-component": type,
  });
}
export function selectionLibrary(base: Library): Library {
  const cached = cache.get(base);
  if (cached) return cached;
  const components = Object.fromEntries(
    Object.entries(base.components).map(([name, def]) => {
      const View = def.component;
      function IdentifiedComponent(props: ComponentRenderProps) {
        // A stable adapter per registered component retains the original hook order.
        const rendered = View(props);
        return props.statementId
          ? tag(rendered as ReactNode, props.statementId, name)
          : rendered;
      }
      return [name, { ...def, component: IdentifiedComponent }];
    }),
  );
  const library = { ...base, components };
  cache.set(base, library);
  return library;
}

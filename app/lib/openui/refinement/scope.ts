import { tokenize } from "@openuidev/lang-core";

export type Statement = {
  id: string;
  expression: string;
  start: number;
  end: number;
};
/** Source ranges are resolved from the immutable program, never from DOM order. */
export function statements(source: string): Statement[] {
  const result: Statement[] = [];
  let depth = 0,
    quote = "",
    escaped = false,
    comment = false,
    start = 0;
  function line(end: number) {
    const text = source.slice(start, end);
    const match = text.match(
      /^\s*([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+?)\s*;?\s*$/,
    );
    if (match) result.push({ id: match[1], expression: match[2], start, end });
    else if (text.trim() && !text.trim().startsWith("//"))
      throw new Error(
        "This definition cannot safely be selected. Use normal refinement.",
      );
    start = end + 1;
  }
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (comment) {
      if (ch === "\n") {
        comment = false;
        if (!depth) line(i);
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "/" && source[i + 1] === "/") comment = true;
    else if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === "\n" && !depth) line(i);
    if (depth < 0) throw new Error("The definition is incomplete.");
  }
  if (quote || depth) throw new Error("The definition is incomplete.");
  if (start < source.length) line(source.length);
  if (new Set(result.map((s) => s.id)).size !== result.length)
    throw new Error("Duplicate definition names cannot be selected safely.");
  return result;
}
function references(expression: string) {
  const tokens = tokenize(expression);
  return tokens
    .filter(
      (t, i) =>
        (t.t === 16 || t.t === 18 || (t.t === 17 && tokens[i + 1]?.t !== 1)) &&
        tokens[i + 1]?.t !== 8 &&
        tokens[i - 1]?.t !== 19,
    )
    .map((t) => String(t.v));
}
export function extractScope(program: string, target: string) {
  const entries = statements(program);
  const selected = entries.find((s) => s.id === target);
  if (!selected || !/^[A-Z]\w*\s*\(/.test(selected.expression))
    throw new Error("Choose a supported component to refine.");
  if (
    entries.reduce(
      (n, s) => n + references(s.expression).filter((r) => r === target).length,
      0,
    ) > 1
  )
    throw new Error(
      "This component is reused. Select its containing section instead.",
    );
  const byId = new Map(entries.map((s) => [s.id, s]));
  const closure = new Set<string>();
  function visit(id: string) {
    if (closure.has(id)) return;
    const s = byId.get(id);
    if (!s) throw new Error("The selection has unresolved dependencies.");
    closure.add(id);
    for (const ref of references(s.expression)) if (byId.has(ref)) visit(ref);
  }
  visit(target);
  if ([...closure].some((id) => id.startsWith("$")))
    throw new Error(
      "This selection uses shared reactive state. Use normal refinement for this change.",
    );
  const types = entries.flatMap(
    (s) => s.expression.match(/^([A-Z]\w*)\s*\(/)?.[1] ?? [],
  );
  const index = selectionIndex(program, types);
  if (!index[target]?.safe)
    throw new Error(
      "This component is reused. Select its containing section instead.",
    );
  const type = selected.expression.match(/^([A-Z]\w*)/)![1];
  return {
    target,
    type,
    dependencyIds: closure,
    parentType: index[index[target]?.parentId ?? ""]?.type,
    selected,
    entries,
    source: [
      selected,
      ...entries.filter((s) => s.id !== target && closure.has(s.id)),
    ]
      .map((s) => `${s.id} = ${s.expression}`)
      .join("\n"),
  };
}
/** Rewrite identifier tokens only, never strings or display content. */
function rename(expression: string, names: Map<string, string>) {
  return expression.replace(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b[A-Za-z_]\w*\b/g,
    (token, offset: number) => {
      if (
        token[0] === '"' ||
        token[0] === "'" ||
        expression
          .slice(offset + token.length)
          .trimStart()
          .startsWith(":")
      )
        return token;
      if (expression.slice(0, offset).trimEnd().endsWith(".")) return token;
      return names.get(token) ?? token;
    },
  );
}
export function mergeReplacement(
  program: string,
  target: string,
  patch: string,
) {
  const scope = extractScope(program, target);
  const replacement = statements(patch);
  if (!replacement.length || replacement[0].id !== "replacement")
    throw new Error("Return replacement = Component(...) first.");
  if (!/^[A-Z]\w*\s*\(/.test(replacement[0].expression))
    throw new Error(
      "Return one registered component at the selection boundary.",
    );
  const ids = new Set(replacement.map((s) => s.id));
  for (const s of replacement) {
    const tokens = tokenize(s.expression);
    if (
      s.id.startsWith("$") ||
      tokens.some(
        (token, i) =>
          token.t === 35 ||
          (["Action", "Query", "Mutation"].includes(String(token.v)) &&
            tokens[i + 1]?.t === 1),
      )
    )
      throw new Error(
        "This replacement introduces unsupported actions or external behavior. Select a larger section or use normal refinement.",
      );
    for (const ref of references(s.expression))
      if (!ids.has(ref))
        throw new Error(
          `The replacement references content outside the selection: ${ref}.`,
        );
  }
  const byId = new Map(replacement.map((s) => [s.id, s]));
  const active = new Set<string>(),
    reachable = new Set<string>();
  function visit(id: string) {
    if (active.has(id))
      throw new Error("The replacement has a circular component reference.");
    if (reachable.has(id)) return;
    active.add(id);
    for (const ref of references(byId.get(id)!.expression)) visit(ref);
    active.delete(id);
    reachable.add(id);
  }
  visit("replacement");
  if (reachable.size !== replacement.length)
    throw new Error(
      "Keep all replacement definitions inside the selected component.",
    );
  const volumes = new Map<string, number>();
  function volume(id: string): number {
    if (volumes.has(id)) return volumes.get(id)!;
    const entry = byId.get(id)!,
      tokens = tokenize(entry.expression);
    let size = tokens.filter(
      (token, i) => token.t === 17 && tokens[i + 1]?.t === 1,
    ).length;
    for (const ref of references(entry.expression)) {
      size += volume(ref);
      if (size > 500) break;
    }
    volumes.set(id, size);
    return size;
  }
  if (volume("replacement") > 500)
    throw new Error("This replacement is too large. Refine a smaller section.");
  // Retire only obsolete private descendants of the selected component. Shared
  // dependencies remain exactly as they were; repeated edits cannot grow a trail
  // of unused definitions or make later requests slower.
  const originalById = new Map(scope.entries.map((s) => [s.id, s]));
  const protectedIds = new Set<string>();
  function protect(id: string) {
    if (id === target || protectedIds.has(id)) return;
    const entry = originalById.get(id);
    if (!entry) return;
    protectedIds.add(id);
    for (const ref of references(entry.expression)) protect(ref);
  }
  for (const entry of scope.entries)
    if (!scope.dependencyIds.has(entry.id))
      for (const ref of references(entry.expression)) protect(ref);
  const retired = new Set(
    [...scope.dependencyIds].filter(
      (id) => id !== target && !protectedIds.has(id),
    ),
  );
  const existing = new Set(
    scope.entries.filter((s) => !retired.has(s.id)).map((s) => s.id),
  );
  let prefix = "iiRefine";
  while ([...ids].some((id) => existing.has(`${prefix}_${id}`))) prefix += "x";
  const names = new Map([...ids].map((id) => [id, `${prefix}_${id}`]));
  const expression = rename(replacement[0].expression, names);
  const original = program.slice(scope.selected.start, scope.selected.end);
  const equals = original.indexOf("=");
  const replacementLine = original.slice(0, equals + 1) + " " + expression;
  const edits = [
    {
      start: scope.selected.start,
      end: scope.selected.end,
      text: replacementLine,
    },
    ...scope.entries
      .filter((s) => retired.has(s.id))
      .map((s) => ({ start: s.start, end: s.end, text: "" })),
  ];
  let merged = program;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    merged = merged.slice(0, edit.start) + edit.text + merged.slice(edit.end);
  merged +=
    replacement.length > 1
      ? "\n" +
        replacement
          .slice(1)
          .map((s) => `${names.get(s.id)} = ${rename(s.expression, names)}`)
          .join("\n")
      : "";
  // Every original declaration outside the selected private dependency closure
  // is unchanged; namespace isolation prevents new references from shadowing it.
  return { program: merged, scope };
}
export function refinementInstruction(
  program: string,
  target: string,
  prompt: string,
) {
  const scope = extractScope(program, target);
  return `Use the registered catalog. Return only a self-contained replacement fragment: replacement = ${scope.type}(...), then its dependencies. Keep existing behavior; change component type only when needed and compatible with its parent. No external references, state declarations, actions or tools. Return OUT_OF_SCOPE if the request requires changing a parent or sibling. This replaces one component inside an existing ${scope.parentType ?? "page"}; no extra page wrapper.\nSelected (data):\n${scope.source}\nChange (user data):\n${JSON.stringify(prompt)}`;
}

/** Hoist inline catalog components into deterministic source-backed declarations.
 * Used only for completed previews; the original streaming path stays untouched.
 * Existing declarations/identities and reactive expressions are retained.
 */
export function normalizeSelectionProgram(
  source: string,
  componentNames: string[],
) {
  const names = new Set(componentNames),
    entries = statements(source),
    used = new Set(entries.map((s) => s.id));
  const additions: string[] = [];
  function transform(expression: string, owner: string, keepRoot: boolean) {
    let result = "",
      at = 0,
      index = 0;
    for (let i = 0; i < expression.length; ) {
      const ch = expression[i];
      if (ch === '"' || ch === "'") {
        const quote = ch;
        i++;
        while (i < expression.length) {
          if (expression[i] === "\\") i += 2;
          else if (expression[i++] === quote) break;
        }
        continue;
      }
      const match = expression.slice(i).match(/^([A-Z]\w*)\s*\(/);
      if (!match || (i > 0 && /[\w@]/.test(expression[i - 1]))) {
        i++;
        continue;
      }
      const open = i + match[0].length - 1;
      let end = open + 1,
        depth = 1,
        quote = "";
      for (; end < expression.length && depth; end++) {
        const c = expression[end];
        if (quote) {
          if (c === "\\") end++;
          else if (c === quote) quote = "";
        } else if (c === '"' || c === "'") quote = c;
        else if (c === "(") depth++;
        else if (c === ")") depth--;
      }
      if (depth) throw new Error("Incomplete component.");
      const root = keepRoot && !expression.slice(0, i).trim();
      let id = `${owner}_inline${index++}`;
      while (used.has(id)) id += "x";
      const hoist = names.has(match[1]) && !root;
      if (hoist) used.add(id);
      const args = transform(
        expression.slice(open + 1, end - 1),
        hoist ? id : owner + "_args" + index,
        false,
      );
      const call = expression.slice(i, open + 1) + args + ")";
      result += expression.slice(at, i);
      if (hoist) {
        additions.push(`${id} = ${call}`);
        result += id;
      } else result += call;
      at = end;
      i = end;
    }
    return result + expression.slice(at);
  }
  const transformed = entries
    .map((s) => `${s.id} = ${transform(s.expression, s.id, true)}`)
    .join("\n");
  return transformed + (additions.length ? "\n" + additions.join("\n") : "");
}
export type SelectionInfo = {
  id: string;
  type: string;
  parentId?: string;
  label: string;
  safe: boolean;
};
export function selectionIndex(
  program: string,
  componentNames: string[],
): Record<string, SelectionInfo> {
  const entries = statements(program),
    names = new Set(componentNames);
  const parents = new Map<string, string[]>();
  for (const s of entries)
    for (const r of references(s.expression))
      parents.set(r, [...(parents.get(r) ?? []), s.id]);
  const components = new Map(
    entries.flatMap((s) => {
      const type = s.expression.match(/^([A-Z]\w*)\s*\(/)?.[1];
      return type && names.has(type) ? [[s.id, type] as const] : [];
    }),
  );
  function ancestor(id: string, seen = new Set<string>()): string | undefined {
    if (seen.has(id)) return;
    seen.add(id);
    const p = parents.get(id)?.[0];
    return p && (components.has(p) ? p : ancestor(p, seen));
  }
  function unshared(id: string, seen = new Set<string>()): boolean {
    if (seen.has(id)) return false;
    seen.add(id);
    const p = parents.get(id) ?? [];
    return p.length <= 1 && (!p[0] || unshared(p[0], seen));
  }
  return Object.fromEntries(
    [...components].map(([id, type]) => [
      id,
      {
        id,
        type,
        parentId: ancestor(id),
        label: type.replace(/([a-z])([A-Z])/g, "$1 $2"),
        safe: unshared(id),
      },
    ]),
  );
}

/** Ignore parser bookkeeping/identifier renaming, not user content. */
export function interfaceFingerprint(value: unknown): string {
  function semantic(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(semantic);
    if (!v || typeof v !== "object") return v;
    const record = v as Record<string, unknown>;
    if (record.type === "element")
      return { component: record.typeName, props: semantic(record.props) };
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, semantic(record[key])]),
    );
  }
  return JSON.stringify(semantic(value));
}

export function selectedElement(value: unknown, id: string): unknown {
  if (!value || typeof value !== "object") return null;
  const node = value as Record<string, unknown>;
  if (node.type === "element" && node.statementId === id) return node;
  for (const child of Object.values(node)) {
    if (child && typeof child === "object") {
      const found = selectedElement(child, id);
      if (found) return found;
    }
  }
  return null;
}

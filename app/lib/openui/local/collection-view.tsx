"use client";
import { useStateField, useIsStreaming } from "@openuidev/react-lang";
import {
  cellText,
  collectRows,
  collectionPage,
  type Controls,
} from "./collection";
/** Controls live in the same renderer store as the surrounding generated UI. */
export function useCollection(
  rows: unknown[][],
  columns: string[],
  options: Controls | undefined,
  id: string,
) {
  const query = useStateField(`${id}:search`, ""),
    filters = useStateField<Record<string, string>>(`${id}:filters`, {}),
    sort = useStateField<{ column: number; direction: "asc" | "desc" } | null>(
      `${id}:sort`,
      null,
    ),
    page = useStateField(`${id}:page`, 1);
  const disabled = useIsStreaming();
  const visible = collectRows(
    rows,
    columns,
    options?.search ? String(query.value) : "",
    Object.fromEntries(
      (options?.filterBy ?? [])
        .filter((name) => columns.includes(name))
        .map((name) => [name, filters.value[name] ?? ""]),
    ),
    options?.sort ? sort.value : null,
  );
  const result = collectionPage(
    visible,
    Number(page.value) || 1,
    options?.pageSize ?? Math.max(1, rows.length),
  );
  const resetPage = () => page.setValue(1);
  return {
    query,
    filters,
    sort,
    page,
    disabled,
    resetPage,
    result,
    count: visible.length,
    changeSort: (column: number) => {
      sort.setValue(
        sort.value?.column === column
          ? sort.value.direction === "desc"
            ? null
            : {
                column,
                direction: "desc",
              }
          : { column, direction: "asc" },
      );
      resetPage();
    },
  };
}
export type CollectionState = ReturnType<typeof useCollection>;
export function CollectionToolbar({
  state,
  rows,
  columns,
  options,
}: {
  state: CollectionState;
  rows: unknown[][];
  columns: string[];
  options?: Controls;
}) {
  if (!options?.search && !options?.filterBy?.length) return null;
  return (
    <div className="ii-collection-toolbar">
      {options.search && (
        <label>
          Search
          <input
            type="search"
            value={String(state.query.value)}
            disabled={state.disabled}
            placeholder="Search…"
            onChange={(e) => {
              state.query.setValue(e.target.value);
              state.resetPage();
            }}
          />
        </label>
      )}
      {options.filterBy
        ?.filter((name) => columns.includes(name))
        .map((name) => (
          <label key={name}>
            {name}
            <select
              aria-label={`Filter ${name}`}
              disabled={state.disabled}
              value={state.filters.value[name] ?? ""}
              onChange={(e) => {
                state.filters.setValue({
                  ...state.filters.value,
                  [name]: e.target.value,
                });
                state.resetPage();
              }}
            >
              <option value="">All {name.toLowerCase()}</option>
              {[
                ...new Set(
                  rows.map((row) => cellText(row[columns.indexOf(name)])),
                ),
              ]
                .filter(Boolean)
                .map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
            </select>
          </label>
        ))}
      <button
        type="button"
        disabled={state.disabled}
        onClick={() => {
          state.query.setValue("");
          state.filters.setValue({});
          state.sort.setValue(null);
          state.resetPage();
        }}
      >
        Reset
      </button>
    </div>
  );
}
export function CollectionPages({ state }: { state: CollectionState }) {
  return (
    <nav className="ii-collection-pages" aria-label="Collection pages">
      <span>
        {state.count} {state.count === 1 ? "result" : "results"}
      </span>
      <button
        type="button"
        disabled={state.disabled || state.result.page <= 1}
        onClick={() => state.page.setValue(state.result.page - 1)}
      >
        Previous
      </button>
      <span>
        Page {state.result.page} of {state.result.total}
      </span>
      <button
        type="button"
        disabled={state.disabled || state.result.page >= state.result.total}
        onClick={() => state.page.setValue(state.result.page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

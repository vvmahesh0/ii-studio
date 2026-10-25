"use client";

import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { collectionControls } from "../local/collection";
import {
  useCollection,
  CollectionToolbar,
  CollectionPages,
} from "../local/collection-view";
import { inline } from "./markdown";
import { cx } from "./style";

const NUMERIC = /^[-+−]?[$€£¥₹]?\s?\d[\d,]*(\.\d+)?\s?(%|[kKmMbB]|bn)?$/;
const isElement = (value: unknown) =>
  !!value &&
  typeof value === "object" &&
  (value as { type?: unknown }).type === "element";

export const Table = defineComponent({
  name: "Table",
  props: z.object({
    columns: z.array(z.string()),
    rows: z.array(z.array(z.any())),
    controls: collectionControls,
  }),
  description:
    "Each row lists its cells in column order; a cell may be a component. Number columns align right. Optional controls enable local search, filterBy column names, sort and pageSize.",
  component: function TableView({ props, renderNode, statementId }) {
    const columns = Array.isArray(props.columns)
      ? props.columns.map((c) => String(c ?? ""))
      : [];
    const rows = (Array.isArray(props.rows) ? props.rows : []).filter(
      Array.isArray,
    ) as unknown[][];
    const state = useCollection(
      rows,
      columns,
      props.controls,
      `table:${statementId ?? "table"}`,
    );
    // A column of numbers (or amounts like "$1.2k" and "45%") aligns right.
    const numeric = columns.map((_, c) => {
      const cells = rows
        .map((r) => r[c])
        .filter(
          (v) =>
            v != null &&
            v !== "" &&
            !(
              typeof v === "string" &&
              /^(n\/a|\u2014|\u2013|-)$/i.test(v.trim())
            ),
        );
      return (
        cells.length > 0 &&
        cells.every(
          (v) =>
            typeof v === "number" ||
            (typeof v === "string" && NUMERIC.test(v.trim())),
        )
      );
    });
    const cell = (value: unknown) =>
      isElement(value)
        ? renderNode(value)
        : typeof value === "number"
          ? value.toLocaleString("en-US", { maximumFractionDigits: 2 })
          : inline(String(value ?? ""));
    return (
      <div className="ii-local-collection">
        <CollectionToolbar
          state={state}
          rows={rows}
          columns={columns}
          options={props.controls}
        />
        <div className="iui-table-scroll">
          <table className="iui-table">
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th
                    key={i}
                    aria-sort={
                      state.sort.value?.column === i
                        ? state.sort.value.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={cx(numeric[i] && "is-numeric")}
                  >
                    {props.controls?.sort ? (
                      <button
                        type="button"
                        disabled={state.disabled}
                        aria-label={`Sort by ${c}`}
                        onClick={() => state.changeSort(i)}
                      >
                        {c}
                        {state.sort.value?.column === i
                          ? state.sort.value.direction === "asc"
                            ? " ↑"
                            : " ↓"
                          : " ↕"}
                      </button>
                    ) : (
                      c
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.result.items.map((row, r) => (
                <tr key={r}>
                  {columns.map((_, c) => (
                    <td key={c} className={cx(numeric[c] && "is-numeric")}>
                      {cell(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!state.count && (
          <p role="status">No matching rows. Change your search or filters.</p>
        )}
        {props.controls?.pageSize && <CollectionPages state={state} />}
      </div>
    );
  },
});

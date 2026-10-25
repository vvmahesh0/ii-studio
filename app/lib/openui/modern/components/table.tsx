"use client";

import {
  Table as ShadcnTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/modern/ui/table";
import { collectionControls } from "../../local/collection";
import {
  useCollection,
  CollectionToolbar,
  CollectionPages,
} from "../../local/collection-view";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";

const ColSchema = z.object({
  header: z.string(),
  type: z.enum(["string", "number", "boolean"]).optional(),
});

export const TableColumn = defineComponent({
  name: "TableColumn",
  props: ColSchema,
  description: "Column definition for Table — header label and optional type.",
  component: () => null,
});

const TableSchema = z.object({
  columns: z.array(TableColumn.ref),
  rows: z.array(z.array(z.any())),
  pageSize: z.number().int().min(1).max(100).optional(),
  controls: collectionControls,
});

export const Table = defineComponent({
  name: "Table",
  props: TableSchema,
  description:
    'Data table. columns: TableColumn[], rows: 2D array, pageSize?, controls?: {search:true,filterBy:["Status"],sort:true}. Built-in local controls work together on supplied rows.',
  component: function TableView({ props, renderNode, statementId }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const columns = ((props.columns ?? []) as any[]).map((c) => ({
      header: String(c?.props?.header ?? ""),
      type: c?.props?.type ?? "string",
    }));
    const rows = (props.rows ?? []) as unknown[][];

    const headers = columns.map((c) => c.header);
    const options = {
      ...props.controls,
      pageSize: props.pageSize ?? props.controls?.pageSize,
    };
    const state = useCollection(
      rows,
      headers,
      options,
      `table:${statementId ?? "table"}`,
    );
    const visibleRows = state.result.items;
    return (
      <div className="ii-local-collection flex flex-col gap-3">
        <CollectionToolbar
          state={state}
          rows={rows}
          columns={headers}
          options={options}
        />
        <div className="rounded-md border">
          <ShadcnTable>
            <TableHeader>
              <TableRow>
                {columns.map((col, i) => (
                  <TableHead
                    key={i}
                    aria-sort={
                      state.sort.value?.column === i
                        ? state.sort.value.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={col.type === "number" ? "text-right" : ""}
                  >
                    {options.sort ? (
                      <button
                        type="button"
                        disabled={state.disabled}
                        aria-label={`Sort by ${col.header}`}
                        onClick={() => state.changeSort(i)}
                      >
                        {col.header}
                        {state.sort.value?.column === i
                          ? state.sort.value.direction === "asc"
                            ? " ↑"
                            : " ↓"
                          : " ↕"}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row, ri) => (
                <TableRow key={ri}>
                  {columns.map((col, ci) => (
                    <TableCell
                      key={ci}
                      className={
                        col.type === "number" ? "text-right tabular-nums" : ""
                      }
                    >
                      {row[ci] &&
                      typeof row[ci] === "object" &&
                      (row[ci] as { type?: string }).type === "element"
                        ? renderNode(row[ci])
                        : String(row[ci] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </ShadcnTable>
        </div>
        {!state.count && (
          <p role="status">No matching rows. Change your search or filters.</p>
        )}
        {options.pageSize && <CollectionPages state={state} />}
      </div>
    );
  },
});

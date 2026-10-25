"use client";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";
import { collectionControls, cellText } from "./collection";
import {
  useCollection,
  CollectionToolbar,
  CollectionPages,
} from "./collection-view";
export const DataList = defineComponent({
  name: "DataList",
  props: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
        status: z.string().optional(),
      }),
    ),
    controls: collectionControls,
  }),
  description:
    'Local searchable/filterable/sortable list. items: [{id,title,description?,status?}], controls: {search:true,filterBy:["Status"],sort:true,pageSize:5}. Uses provided data only.',
  component: function DataListView({ props, statementId }) {
    const items = props.items ?? [],
      rows = items.map((item) => [
        item.title,
        item.description ?? "",
        item.status ?? "",
        item.id,
      ]),
      columns = ["Title", "Description", "Status", "ID"];
    const state = useCollection(
      rows,
      columns,
      props.controls,
      `list:${statementId ?? "list"}`,
    );
    return (
      <div className="ii-local-collection">
        <CollectionToolbar
          state={state}
          rows={rows}
          columns={columns}
          options={props.controls}
        />
        {props.controls?.sort && (
          <label className="ii-list-sort">
            Sort
            <select
              aria-label="Sort list"
              disabled={state.disabled}
              value={state.sort.value?.direction ?? "original"}
              onChange={(e) => {
                state.sort.setValue(
                  e.target.value === "original"
                    ? null
                    : {
                        column: 0,
                        direction: e.target.value as "asc" | "desc",
                      },
                );
                state.resetPage();
              }}
            >
              <option value="original">Original order</option>
              <option value="asc">Title A–Z</option>
              <option value="desc">Title Z–A</option>
            </select>
          </label>
        )}
        <ul className="ii-data-list">
          {state.result.items.map((row) => (
            <li key={cellText(row[3])}>
              <div>
                <strong>{cellText(row[0])}</strong>
                {!!row[1] && <p>{cellText(row[1])}</p>}
              </div>
              {!!row[2] && <span>{cellText(row[2])}</span>}
            </li>
          ))}
        </ul>
        {!state.count && (
          <p role="status">No matching items. Change your search or filters.</p>
        )}
        {props.controls?.pageSize && <CollectionPages state={state} />}
      </div>
    );
  },
});

import { dimensions, type Diagram } from "./contract.ts";
export function layoutGraph(document: Diagram) {
  return {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": document.direction,
      "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": "65",
      "elk.spacing.edgeNode": "25",
      "elk.layered.spacing.edgeNodeBetweenLayers": "25",
      "elk.layered.spacing.nodeNodeBetweenLayers": "85",
      "elk.padding": "[top=40,left=60,bottom=40,right=60]",
    },
    children: document.nodes.map((n) => {
      const { width, height } = dimensions(n),
        horizontal = document.direction === "RIGHT";
      return {
        id: n.id,
        width,
        height,
        layoutOptions: {
          "elk.portConstraints": "FIXED_POS",
          "elk.layered.layering.layerConstraint":
            n.kind === "start" ? "FIRST" : "NONE",
        },
        ports: [
          {
            id: `${n.id}:in`,
            x: horizontal ? 0 : width / 2 - 7,
            y: horizontal ? height / 2 - 7 : 0,
            width: 0,
            height: 0,
            layoutOptions: { "elk.port.side": horizontal ? "WEST" : "NORTH" },
          },
          {
            id: `${n.id}:out`,
            x: horizontal ? width : width / 2 + 7,
            y: horizontal ? height / 2 + 7 : height,
            width: 0,
            height: 0,
            layoutOptions: { "elk.port.side": horizontal ? "EAST" : "SOUTH" },
          },
        ],
      };
    }),
    edges: document.edges
      .filter(
        (e) =>
          document.nodes.some((n) => n.id === e.source) &&
          document.nodes.some((n) => n.id === e.target),
      )
      .map((e) => ({
        id: e.id,
        sources: [`${e.source}:out`],
        targets: [`${e.target}:in`],
        labels: e.label
          ? [
              {
                id: `${e.id}:label`,
                text: e.label,
                width: Math.min(720, e.label.length * 7 + 16),
                height: 24,
                layoutOptions: { "elk.edgeLabels.placement": "CENTER" },
              },
            ]
          : [],
      })),
  };
}

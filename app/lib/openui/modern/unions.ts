import { z } from "zod";
import { tagSchemaId } from "@openuidev/react-lang";
const node = z.any();
tagSchemaId(node, "Node");
export const ContentChildUnion = node;

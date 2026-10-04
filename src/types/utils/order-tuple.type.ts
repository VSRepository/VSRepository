import { VSSql } from "../../internal/utils/vs-sql.util.js";
import { SortDirection } from "./ordering.type.js";

export type OrderTuple = [column: string | VSSql, direction?: SortDirection];

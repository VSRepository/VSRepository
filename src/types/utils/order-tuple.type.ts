import { VSSql } from "../../internal/utils/vs-sql.util.js";
import { SortDirection } from "./ordering.type.js";

/**
 * A column (or `VSSql` fragment) with an optional direction, as accepted by `VSRawQueryBuilder.orderBy`.
 *
 * @publicApi
 */
export type OrderTuple = [column: string | VSSql, direction?: SortDirection];

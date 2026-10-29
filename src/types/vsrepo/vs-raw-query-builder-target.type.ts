import { VSRawQueryBuilder } from "../../internal/utils/vs-raw-query-builder.util.js";
import { VSSql } from "../../internal/utils/vs-sql.util.js";

/**
 * A table reference: a raw name, a `VSSql` fragment, a builder, or a function that receives a sub-builder
 * (the last two are compiled as subqueries).
 *
 * @publicApi
 */
export type VSRawQueryBuilderTarget =
    string | VSSql | VSRawQueryBuilder | ((subquery: VSRawQueryBuilder) => VSRawQueryBuilder | VSSql);

import { VSRawQueryBuilder } from "../../internal/utils/vs-raw-query-builder.util.js";
import { VSSql } from "../../internal/utils/vs-sql.util.js";

/**
 * A CTE body: a `VSSql` fragment, a builder, or a function that receives a sub-builder.
 *
 * @publicApi
 */
export type VSRawQueryBuilderCteQuery =
    VSSql | VSRawQueryBuilder | ((cte: VSRawQueryBuilder) => VSRawQueryBuilder | VSSql);

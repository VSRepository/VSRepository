import { VSRawQueryBuilder } from "../../internal/utils/vs-raw-query-builder.util.js";
import { VSSql } from "../../internal/utils/vs-sql.util.js";

/** Anything that can be used as a CTE's body.
 *
 * @publicApi
 */
export type VSRawQueryBuilderCteQuery =
    VSSql | VSRawQueryBuilder | ((cte: VSRawQueryBuilder) => VSRawQueryBuilder | VSSql);

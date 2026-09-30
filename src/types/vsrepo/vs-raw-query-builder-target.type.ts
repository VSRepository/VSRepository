import { VSRawQueryBuilder } from "../../internal/utils/vs-raw-query-builder.util.js";
import { VSSql } from "../../internal/utils/vs-sql.util.js";

/** Anything that can be used where a table/column reference is expected.
 *
 * @publicApi
 */
export type VSRawQueryBuilderTarget =
    string | VSSql | VSRawQueryBuilder | ((subquery: VSRawQueryBuilder) => VSRawQueryBuilder | VSSql);

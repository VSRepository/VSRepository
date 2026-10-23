import { SeeMode } from "./see-mode.type.js";
import { VSRepoOrmTypes } from "../vsrepo/vsrepo-orm-types.type.js";
import { VSRepoRelations } from "../vsrepo/vsrepo-relations.type.js";
import { VSRepoSelect } from "../vsrepo/vsrepo-select.type.js";
import { ClientOrTransaction } from "./client-or-transaction.type.js";
import { Pagination } from "./pagination.type.js";
import { Ordering } from "./ordering.type.js";

/**
 * @publicApi
 */
export type MethodOptions<T, K extends VSRepoOrmTypes = VSRepoOrmTypes> = {
    /** Fields (and nested relation fields) to select in the result. */
    select?: VSRepoSelect<T>;
    /** Relations to eagerly load alongside the result. */
    relations?: VSRepoRelations<T>;
    /** Visibility mode for records with soft-delete. Defaults to `"active"`. */
    see?: SeeMode;
    /** Database client or transaction to run this operation in, instead of the repository's default client. */
    db?: ClientOrTransaction<K>;

    pagination?: Pagination;

    order?: Ordering<T>;
};

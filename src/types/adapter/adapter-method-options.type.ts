import { Ordering } from "../utils/ordering.type.js";
import { Pagination } from "../utils/pagination.type.js";
import { VSRepoRelations } from "../vsrepo/vsrepo-relations.type.js";
import { VSRepoSelect } from "../vsrepo/vsrepo-select.type.js";

/**
 * Options passed down to a `VSRepoAdapter` method call, after `VSRepository`
 * has resolved and validated the caller-provided `MethodOptions`.
 *
 * @template T Entity type managed by the repository.
 *
 * @publicApi
 */
export type AdapterMethodOptions<T> = {
    /** Fields (and nested relation fields) to select in the result. */
    select?: VSRepoSelect<T>;
    /** Relations to eagerly load alongside the result. */
    relations?: VSRepoRelations<T>;
    /** Pagination to apply to the query. */
    pagination?: Pagination;
    /** Ordering to apply to the query. */
    order?: Ordering<T>;
    /** Database client or transaction to run this operation in. */
    db?: any;
};

import { SeeMode } from "./see-mode.type.js";
import { VSRepoOrmTypes } from "../vsrepo/vsrepo-orm-types.type.js";
import { VSRepoRelations } from "../vsrepo/vsrepo-relations.type.js";
import { VSRepoSelect } from "../vsrepo/vsrepo-select.type.js";

/**
 * Options accepted by the base methods exposed by `VSRepository`
 * (`get`, `getOrThrow`, `save`, `patch`, `remove`, etc) and by dynamic methods.
 *
 * @template T Entity type managed by the repository.
 * @template K ORM type map (`dbClient`/`dbTransaction`) configured on the repository.
 *
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
    db?: K["dbClient"] | K["dbTransaction"];
};

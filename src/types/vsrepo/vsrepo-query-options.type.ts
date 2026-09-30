import { VSRepoOrmTypes } from "./vsrepo-orm-types.type.js";

/**
 * Options accepted by `VSRepository.query()`.
 *
 * @publicApi
 */
export type VSRepoQueryOptions<T extends VSRepoOrmTypes = VSRepoOrmTypes> = {
    /** Positional parameters injected into the SQL placeholders — the placeholder syntax depends on the database/driver behind your adapter. */
    args?: any[];
    /** Database client or transaction to run this query in, instead of the repository's default client. */
    db?: T["dbClient"] | T["dbTransaction"];
    /**
     * Whether this is a modifying statement (`INSERT`/`UPDATE`/`DELETE`).
     * @default false
     */
    modifying?: boolean;
    /**
     * When `true`, the array returned by the underlying query is collapsed
     * into its first element (`null` if the array is empty) before
     * being resolved to the caller. Has no effect when the query resolves
     * to something other than an array (e.g. a `modifying` query's
     * affected-row count).
     *
     * Useful for queries you already know return at most one row (e.g. a
     * `SELECT ... LIMIT 1` or a lookup by a unique column), where declaring
     * the return type as an array would be misleading.
     *
     * @default false
     */
    singleResult?: boolean;
};

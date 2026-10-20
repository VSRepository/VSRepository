/**
 * Options accepted by the `@QueryMethod` decorator.
 *
 * @publicApi
 */
export type QueryMethodOptions = {
    /**
     * When `true`, the SQL is executed as a modifying statement (`INSERT`/`UPDATE`/`DELETE`)
     * and the decorated method always resolves to the number of affected rows.
     * When `false`, the SQL is executed as a read query and the method resolves
     * to whatever return type is declared on the field.
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

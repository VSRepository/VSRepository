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

    /**
     * By default, the decorated method receives its SQL placeholder values
     * as separate positional arguments (`method(a, b, c)`).
     *
     * To run the query against a specific client or transaction — instead
     * of the repository's default one — pass {@link DbArg} (built via
     * {@link withDb}) as the trailing argument: `method(a, b, withDb(tx))`.
     * It's recognized by `instanceof`, so it never collides with a regular
     * positional argument, even one that happens to be an object.
     *
     * When `true`, the method instead receives a single {@link QueryMethodArg}
     * object (`method({ args: [a, b, c], db })`), and calling it with more
     * than one argument throws.
     *
     * @default false
     */
    singleArg?: boolean;
};

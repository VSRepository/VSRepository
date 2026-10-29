/**
 * Options accepted by the `@QueryMethod` decorator.
 *
 * @publicApi
 */
export type QueryMethodOptions = {
    /**
     * Whether the SQL modifies data (`INSERT`/`UPDATE`/`DELETE`). Resolves to the number of affected rows.
     *
     * @default false
     */
    modifying?: boolean;

    /**
     * When `true`, an array result is replaced by its first element (`null` if empty).
     * Useful for queries known to return at most one row.
     *
     * @default false
     */
    singleResult?: boolean;
};

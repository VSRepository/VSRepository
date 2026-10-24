/**
 * Options passed to `VSRepoAdapter.query()`.
 *
 * @publicApi
 */
export type AdapterQueryOptions = {
    /** Positional parameters, already matching the adapter's placeholders. */
    args?: any[];
    /** Database client or transaction to run the query in. */
    db?: any;
    /** Whether the statement modifies data (`INSERT`/`UPDATE`/`DELETE`). */
    modifying: boolean;
};

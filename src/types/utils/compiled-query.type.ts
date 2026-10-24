/**
 * Result of `VSSql.compile()`: the SQL string and its positional arguments.
 *
 * @publicApi
 */
export type CompiledQuery = { query: string; args: unknown[] };

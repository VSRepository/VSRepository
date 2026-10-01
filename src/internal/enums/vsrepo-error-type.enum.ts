/**
 * Category of a `VSRepoError`, identifying which layer of the library raised it.
 *
 * @publicApi
 */
export enum VSRepoErrorType {
    /** Invalid arguments passed to `@DynamicMethod` or `@QueryMethod`. */
    DECORATOR = "DECORATOR",
    /** Failure while resolving a dynamic or query method's configuration into a callable method. */
    RESOLVER = "RESOLVER",
    /** Failure while executing a resolved dynamic/query method at runtime. */
    DYNAMIC = "DYNAMIC",
    /** Invalid method options or arguments detected during validation. */
    VALIDATOR = "VALIDATOR",
    /** Invalid usage of a base method (`get`, `save`, `remove`, etc). */
    BASE = "BASE",
    /** Failure raised by a `VSRepoAdapter` while talking to the underlying ORM/database. */
    ADAPTER = "ADAPTER",
    /** An invalid argument was passed to a `VSQueryBuilder` method (e.g. a negative `limit`) */
    QUERY_BUILDER = "QUERY_BUILDER",
    /** Invalid usage of the `VSSql` class */
    VSSQL = "VSSQL",
}

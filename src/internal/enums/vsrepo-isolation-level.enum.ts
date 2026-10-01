/**
 * Isolation levels accepted by `VSRepository.transaction()`, mirroring the
 * standard SQL isolation levels.
 *
 * @publicApi
 */
export enum VSRepoIsolationLevel {
    /** Allows dirty reads: a transaction may see uncommitted changes from other transactions. */
    READ_UNCOMMITTED = "ReadUncommitted",
    /** Prevents dirty reads; non-repeatable reads and phantom reads may still occur. */
    READ_COMMITTED = "ReadCommitted",
    /** Prevents dirty and non-repeatable reads; phantom reads may still occur. */
    REPEATABLE_READ = "RepeatableRead",
    /** Strongest isolation level: transactions behave as if executed sequentially. */
    SERIALIZABLE = "Serializable",
}

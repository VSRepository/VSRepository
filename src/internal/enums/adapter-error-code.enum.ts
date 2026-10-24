/**
 * Granular error codes that a `VSRepoAdapter` can raise via `VSRepoAdapterError`,
 * mirroring the most common failures thrown by ORMs and database drivers so they
 * can be mapped to a stable, adapter-agnostic code.
 *
 * @publicApi
 */
export enum AdapterErrorCode {
    /**
     * An unknown/unclassified error raised by the database or ORM.
     * Fallback when no more specific code matches.
     */
    UNKNOWN = "UNKNOWN",

    /**
     * A transaction was rolled back on purpose (e.g. Drizzle's `tx.rollback()`), for adapters that report it.
     */
    TRANSACTION_ROLLED_BACK = "TRANSACTION_ROLLED_BACK",

    /**
     * The database client (or connection pool) backing the adapter was not
     * provided or could not be resolved.
     */
    MISSING_DB_CLIENT = "MISSING_DB_CLIENT",

    /**
     * The adapter could not reach/connect to the database, or an established
     * connection was lost/terminated.
     */
    CONNECTION_FAILED = "CONNECTION_FAILED",

    /**
     * The connection pool is exhausted or depleted: no connection was available
     * because they were all busy or the configured limit was reached.
     */
    CONNECTION_POOL_EXHAUSTED = "CONNECTION_POOL_EXHAUSTED",

    /**
     * The database did not respond in time; a connection/query/statement
     * exceeded its allowed timeout.
     */
    TIMEOUT = "TIMEOUT",

    /**
     * The operation violated a unique constraint (duplicate key).
     * E.g. Postgres/SQLite `23505`, MySQL `1062`.
     */
    UNIQUE_CONSTRAINT_VIOLATION = "UNIQUE_CONSTRAINT_VIOLATION",

    /** A foreign key constraint was violated (referenced row missing). */
    FOREIGN_KEY_VIOLATION = "FOREIGN_KEY_VIOLATION",

    /** A NOT NULL constraint was violated. */
    NOT_NULL_VIOLATION = "NOT_NULL_VIOLATION",

    /** A CHECK constraint was violated. */
    CHECK_VIOLATION = "CHECK_VIOLATION",

    /** A general integrity/constraint violation not covered by more specific codes. */
    CONSTRAINT_VIOLATION = "CONSTRAINT_VIOLATION",

    /** The requested record was not found (e.g. a `findOneOrThrow`-style operation). */
    NOT_FOUND = "NOT_FOUND",

    /**
     * The value(s) provided for a field are invalid for its type or length, or a
     * required value is missing.
     */
    INVALID_DATA = "INVALID_DATA",

    /**
     * The provided value is too long and exceeds the column/field length limit.
     */
    VALUE_TOO_LONG = "VALUE_TOO_LONG",

    /**
     * A value could not be converted/cast to the target type.
     * E.g. Postgres `22P02` invalid text representation, MySQL `1366` incorrect value.
     */
    CONVERSION_ERROR = "CONVERSION_ERROR",

    /** The query/stored procedure SQL is malformed or invalid. */
    INVALID_QUERY = "INVALID_QUERY",

    /** The referenced table/column/relation does not exist. */
    TABLE_OR_COLUMN_NOT_FOUND = "TABLE_OR_COLUMN_NOT_FOUND",

    /**
     * The operation was aborted by a lock timeout or a deadlock between
     * concurrent transactions.
     */
    DEADLOCK = "DEADLOCK",

    /** The operation could not acquire a required database lock in time. */
    LOCK_TIMEOUT = "LOCK_TIMEOUT",

    /** The record is locked and cannot be modified. */
    LOCKED = "LOCKED",

    /** The current user/role does not have permission to perform the operation. */
    ACCESS_DENIED = "ACCESS_DENIED",

    /** Invalid connection credentials (host/user/password) provided. */
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS",

    /** The authenticated user does not own the record / row-level security rejected it. */
    ROW_NOT_ALLOWED = "ROW_NOT_ALLOWED",

    /**
     * The entity/model or table is not defined/mapped in the ORM, or the adapter
     * lacks the model metadata to build the query.
     */
    MODEL_NOT_FOUND = "MODEL_NOT_FOUND",

    /**
     * A field/column name in the provided data or `where` does not exist on the
     * entity/model.
     */
    FIELD_NOT_FOUND = "FIELD_NOT_FOUND",

    /** A transaction was used after it was committed/rolled back. */
    TRANSACTION_CLOSED = "TRANSACTION_CLOSED",

    /** A nested transaction could not be opened (e.g. nested `transaction()` calls). */
    TRANSACTION_ALREADY_STARTED = "TRANSACTION_ALREADY_STARTED",

    /** A transaction failed to commit (e.g. due to a write conflict) and was rolled back. */
    TRANSACTION_CONFLICT = "TRANSACTION_CONFLICT",

    /** No active transaction when one was required for the operation. */
    TRANSACTION_NOT_STARTED = "TRANSACTION_NOT_STARTED",

    /**
     * The connection was closed/terminated while a transaction or query was
     * still in progress.
     */
    CONNECTION_CLOSED = "CONNECTION_CLOSED",

    /**
     * The value provided to a `merge`/`upsert`/`update` is a partial object but
     * is invalid or missing required keys.
     */
    INVALID_PARTIAL = "INVALID_PARTIAL",

    /**
     * An unsupported feature/operation was requested from the adapter (e.g. raw
     * `query()` not supported by the underlying ORM).
     */
    NOT_SUPPORTED = "NOT_SUPPORTED",

    /**
     * The adapter configuration provided is invalid or incomplete (e.g. missing
     * required options, or options with an invalid type/value).
     */
    INVALID_ADAPTER_CONFIG = "INVALID_ADAPTER_CONFIG",

    /**
     * An internal adapter bug or an unrecoverable state occurred. Should rarely
     * be used; prefer a more specific code.
     */
    INTERNAL = "INTERNAL",
}

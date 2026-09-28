<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./error-handling.pt-BR.md)

[← Back to the table of contents](./README.md)

# Error handling

The error model is built around a single base `VSRepoError` class carrying a `type: VSRepoErrorType`, plus a dedicated `VSRepoAdapterError` subclass (see below) for failures coming from the underlying ORM/database. (If you're migrating from v1, this is covered in [Migrating from v1](./migrating-from-v1.md).)

```typescript
import { VSRepoError } from "vsrepo";

try {
    await userRepository.get(id);
} catch (error) {
    if (error instanceof VSRepoError) {
        console.error(`[${error.type}] ${error.message}`);
    }
}
```

| `VSRepoErrorType` | Raised when                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `DECORATOR`       | Invalid arguments were passed to `@DynamicMethod` or `@QueryMethod`.                                                                 |
| `RESOLVER`        | The library failed to resolve a dynamic/query method's configuration into a callable method (e.g. an unknown method name).           |
| `DYNAMIC`         | A resolved dynamic/query method failed at runtime (e.g. missing arguments).                                                          |
| `VALIDATOR`       | Invalid method options or arguments were detected during validation (e.g. a missing `pkName` when the adapter has no `getPkName()`). |
| `BASE`            | Invalid usage of a base method (`get`, `save`, `remove`, etc).                                                                       |
| `ADAPTER`         | A `VSRepoAdapter` failed while talking to the underlying ORM/database — always thrown as `VSRepoAdapterError`.                       |
| `QUERY_BUILDER`   | An invalid argument was passed to a [query builder](./query-builder.md#validation-and-errors) method (e.g. a negative `limit`).      |

## `VSRepoAdapterError` and `AdapterErrorCode`

When an adapter talks to the underlying ORM/database and that operation fails, the adapter wraps the failure in a `VSRepoAdapterError` — a subclass of `VSRepoError` with `type: VSRepoErrorType.ADAPTER`. It carries a **stable, adapter-agnostic** `code: AdapterErrorCode` plus the raw error thrown by the ORM/driver, so callers can react to failures without depending on any single ORM's error shape:

```typescript
import { VSRepoAdapterError, AdapterErrorCode } from "vsrepo";

try {
    await userRepository.save({ name: "Maria" });
} catch (error) {
    if (error instanceof VSRepoAdapterError) {
        console.error(`[${error.code}] ${error.message}`, error.originalError);

        if (error.code === AdapterErrorCode.UNIQUE_CONSTRAINT_VIOLATION) {
            // handle a duplicate key, e.g. return a friendly message
        }
    }
}
```

| Property        | Type               | Description                                                                         |
| --------------- | ------------------ | ----------------------------------------------------------------------------------- |
| `code`          | `AdapterErrorCode` | Stable, adapter-agnostic code classifying the failure.                              |
| `originalError` | `unknown`          | The raw error (or `null`/`undefined`) thrown by the underlying ORM/database driver. |
| `message`       | `string`           | Human-readable description of the adapter failure.                                  |
| `type`          | `VSRepoErrorType`  | Always `VSRepoErrorType.ADAPTER`.                                                   |
| `cause`         | `unknown`          | Optional root cause the error was chained from.                                     |

Adapter implementations construct it directly when mapping an ORM failure:

```typescript
import { VSRepoAdapterError, AdapterErrorCode } from "vsrepo";

throw new VSRepoAdapterError(
    "user creation failed",
    AdapterErrorCode.UNIQUE_CONSTRAINT_VIOLATION,
    originalError, // raw DB/driver error
);
```

### `AdapterErrorCode`

`AdapterErrorCode` is an enum of granular, adapter-agnostic codes an adapter can raise through `VSRepoAdapterError`. They mirror the most common failures thrown by ORMs and database drivers so any ORM's errors can be mapped to the same stable code:

```typescript
import { AdapterErrorCode } from "vsrepo";

console.log(AdapterErrorCode.UNIQUE_CONSTRAINT_VIOLATION); // "UNIQUE_CONSTRAINT_VIOLATION"
```

| Code                          | Meaning                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `UNKNOWN`                     | Unclassified/unknown error; the fallback when no more specific code matches.                                   |
| `TRANSACTION_ROLLED_BACK`     | Some adapters might use this code for forced transaction rollbacks (like Drizzle's `tx.rollback()`)            |
| `MISSING_DB_CLIENT`           | Database client (or connection pool) not provided or could not be resolved.                                    |
| `CONNECTION_FAILED`           | Could not reach/connect to the database, or an established connection was lost/terminated.                     |
| `CONNECTION_POOL_EXHAUSTED`   | Connection pool exhausted/depleted — no connection available, all busy or the limit was reached.               |
| `TIMEOUT`                     | Database did not respond in time; a query exceeded its allowed timeout.                                        |
| `UNIQUE_CONSTRAINT_VIOLATION` | Unique constraint (duplicate key) violated. E.g. Postgres/SQLite `23505`, MySQL `1062`.                        |
| `FOREIGN_KEY_VIOLATION`       | Foreign key constraint violated (referenced row missing).                                                      |
| `NOT_NULL_VIOLATION`          | NOT NULL constraint violated.                                                                                  |
| `CHECK_VIOLATION`             | CHECK constraint violated.                                                                                     |
| `CONSTRAINT_VIOLATION`        | General integrity/constraint violation not covered by a more specific code.                                    |
| `NOT_FOUND`                   | Requested record not found (e.g. a `findOneOrThrow`-style operation).                                          |
| `INVALID_DATA`                | Field value invalid for its type/length, or a required value is missing.                                       |
| `VALUE_TOO_LONG`              | Provided value exceeds the column/field length limit.                                                          |
| `CONVERSION_ERROR`            | Value could not be converted/cast to the target type. E.g. Postgres `22P02`, MySQL `1366`.                     |
| `INVALID_QUERY`               | SQL query/stored procedure is malformed or invalid.                                                            |
| `TABLE_OR_COLUMN_NOT_FOUND`   | Referenced table/column/relation does not exist.                                                               |
| `DEADLOCK`                    | Operation aborted by a lock timeout or deadlock between concurrent transactions.                               |
| `LOCK_TIMEOUT`                | Could not acquire a required database lock in time.                                                            |
| `LOCKED`                      | Record is locked and cannot be modified.                                                                       |
| `ACCESS_DENIED`               | Current user/role does not have permission for the operation.                                                  |
| `INVALID_CREDENTIALS`         | Invalid connection credentials (host/user/password).                                                           |
| `ROW_NOT_ALLOWED`             | Authenticated user does not own the record / row-level security rejected it.                                   |
| `MODEL_NOT_FOUND`             | Entity/model or table not defined/mapped in the ORM, or the adapter lacks model metadata to build the query.   |
| `FIELD_NOT_FOUND`             | Field/column name in the data or `where` does not exist on the entity/model.                                   |
| `TRANSACTION_CLOSED`          | Transaction used after it was committed/rolled back.                                                           |
| `TRANSACTION_ALREADY_STARTED` | A nested transaction could not be opened (e.g. nested `transaction()` calls).                                  |
| `TRANSACTION_CONFLICT`        | Transaction failed to commit and was rolled back.                                                              |
| `TRANSACTION_NOT_STARTED`     | No active transaction when one was required.                                                                   |
| `CONNECTION_CLOSED`           | Connection closed/terminated while a transaction or query was in progress.                                     |
| `INVALID_PARTIAL`             | `merge`/`upsert`/`update` received a partial object that is invalid or missing required keys.                  |
| `NOT_SUPPORTED`               | Unsupported feature/operation requested from the adapter (e.g. raw `query()` not supported).                   |
| `INVALID_ADAPTER_CONFIG`      | Adapter configuration invalid or incomplete (missing required options, or options with an invalid type/value). |
| `INTERNAL`                    | Internal adapter bug or unrecoverable state; should rarely be used — prefer a more specific code.              |

### `VSRepoError` vs. raw ORM errors

Non-adapter usage/config mistakes throw the base `VSRepoError`. Failures raised _by the underlying ORM_ while an adapter method runs are **wrapped** in `VSRepoAdapterError` (classified by an `AdapterErrorCode`, with the original error preserved in `originalError`) instead of propagating raw — this is what makes callers independent of any specific ORM's error shape.

[⬆️ Back to top](#top)

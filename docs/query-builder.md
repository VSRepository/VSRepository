<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./query-builder.pt-BR.md)

[← Back to the table of contents](./README.md)

# Query builder

`createQueryBuilder(db?)` returns a fluent builder for queries whose shape is only known at runtime — optional filters, user-controlled ordering and pagination, and so on — where declaring a `@DynamicMethod` for every combination would be impractical. It's available on every `VSRepository` instance and goes through the same adapter as every other method:

```typescript
const { result, count } = await userRepository
    .createQueryBuilder()
    .where({ active: true, balance: { gte: 100 } })
    .relations({ address: true })
    .orderBy({ createdAt: "desc" })
    .limit(20)
    .offset(40)
    .getResultAndCount();
```

Nothing reaches the database until a **terminal method** (`getResult()`, `getCount()`, ...) is called. The builder is **mutable**: every chained call changes the same instance and returns it, so use [`clone()`](#reusing-and-cloning-a-builder) to derive variations from a common base. The `VSQueryBuilder<Entity>` class is exported from `vsrepo` in case you need to type a builder (e.g. as a function parameter).

For queries whose SQL is too specific for this builder's `where`/`relations` model — window functions, vendor-specific syntax, ad-hoc subqueries, CTEs — see the [Raw query builder](./raw-query-builder.md) instead.

## Building the query

| Method                 | Description                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `select(select)`       | Fields (and nested relation fields) to select — same shape as in [`select` and `relations`](./select-and-relations.md#select-and-relations). Replaces any previous `select`. |
| `relations(relations)` | Relations to eagerly load. Replaces any previous `relations`.                                                                                                                |
| `where(where)`         | The filter: the same `VSRepoWhere` used by the rest of the library (field operators, relation filters and `AND`/`OR`/`NOT`). Replaces any previous filter.                   |
| `orderBy(order)`       | An object or an array of objects with `"asc"`/`"desc"` (lower or upper case). Only scalar fields can be ordered. Replaces any previous ordering.                             |
| `limit(limit)`         | Maximum number of records. Must be a non-negative integer.                                                                                                                   |
| `offset(offset)`       | Number of records to skip. Must be a non-negative integer.                                                                                                                   |
| `distinctOn(fields)`   | A primitive field, or an array of them, to apply `distinct` on. Only used by `getResult()`.                                                                                  |
| `see(mode)`            | Soft-delete visibility: `"active"` (default), `"removed"` or `"all"`. See [Soft-delete with `see()`](#soft-delete-with-see).                                                 |

Calling `where()` again replaces the previous filter, and the [soft-delete](#soft-delete-with-see) filter is added on top of it when the query runs. Since the builder is mutable, a filter that depends on optional inputs is easiest to build as an object first:

```typescript
import type { VSRepoWhere } from "vsrepo";

async function search(filters: { name?: string; onlyActive?: boolean; page: number }) {
    const where: VSRepoWhere<User> = {};

    if (filters.name) where.name = { contains: filters.name, ignoreCase: true };
    if (filters.onlyActive) where.active = true;

    return userRepository
        .createQueryBuilder()
        .where(where)
        .orderBy({ createdAt: "desc" })
        .limit(20)
        .offset((filters.page - 1) * 20)
        .getResultAndCount();
}
```

## Getting results

| Method                  | Returns                               | Adapter call         | Sent to the adapter                                                                  |
| ----------------------- | ------------------------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| `getResult()`           | `Entity[]`                            | `findMany`           | `where`, `select`, `relations`, `order`, `pagination`, `distinct`                    |
| `getOneResult()`        | `Entity \| null`                      | `findOne`            | `where`, `select`, `relations`, `order`, `pagination`                                |
| `getOneResultOrThrow()` | `Entity` (throws if not found)        | `findOneOrThrow`     | `where`, `select`, `relations`, `order`, `pagination`                                |
| `getCount()`            | `number`                              | `count`              | `where`, `order`, `pagination`                                                       |
| `getExistence()`        | `boolean`                             | `exists`             | `where`                                                                              |
| `getResultAndCount()`   | `{ result: Entity[]; count: number }` | `findMany` + `count` | `findMany`: `where`, `select`, `relations`, `order`, `pagination` — `count`: `where` |

Every terminal method also applies the [`see`](#soft-delete-with-see) mode to the `where` and runs on the builder's `db` (see [`setDb()`](#transactions-and-setdb)). Notes:

- Results are typed as the whole `Entity`, just like the base methods — `select` and `relations` change what is loaded, not the type. See [Strict return typing with `InferMethodReturn`](./select-and-relations.md#strict-return-typing-with-infermethodreturn) if you want it narrowed.
- `distinctOn()` is only sent by `getResult()`: `count` doesn't support `distinct`, so `getCount()`, `getExistence()` and `getResultAndCount()` don't use it.
- `getCount()` forwards `order` and `pagination` to the adapter's `count`. If you want the total of a builder that has pagination, use `getResultAndCount()` or count from a [`clone()`](#reusing-and-cloning-a-builder) without it.

## Pagination with `getResultAndCount()`

Fetches a page and the total number of matching records in one call, like MikroORM's `getResultAndCount()`. `result` honors `order`, `limit` and `offset`; `count` ignores `order` and `pagination` on purpose — it's the total of records matching the `where`, so you can compute the number of pages. Both queries run in parallel with the same resolved `where` and the same `db`.

```typescript
const pageSize = 20;

const { result, count } = await userRepository
    .createQueryBuilder()
    .where({ active: true })
    .orderBy({ createdAt: "desc" })
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .getResultAndCount();

const totalPages = Math.ceil(count / pageSize);
```

## Soft-delete with `see()`

On a repository with [`softRemoveKey`](./base-methods.md#soft-delete), the builder only sees non-deleted records by default, like every other method. Use `see()` to change that — it applies to every terminal method (both queries of `getResultAndCount()` included):

```typescript
await userRepository.createQueryBuilder().getResult(); // default — only non-deleted records
await userRepository.createQueryBuilder().see("removed").getResult(); // only soft-deleted records
await userRepository.createQueryBuilder().see("all").getResult(); // everything, ignoring soft-delete
```

Repositories without `softRemoveKey` ignore `see()`.

## Transactions and `setDb()`

`createQueryBuilder(db?)` accepts the client or transaction to run in. Since nothing runs until a terminal method is called, you can also build the query first and choose where it runs later with `setDb()`:

```typescript
const qb = userRepository.createQueryBuilder().where({ active: true }).orderBy({ createdAt: "desc" });

await userRepository.transaction(async tx => {
    qb.setDb(tx); // from here on, the builder runs inside the transaction
    const users = await qb.getResult();

    await userLogsRepository.save({ action: "Users listed", data: { count: users.length } }, { db: tx });
});
```

`setDb()` is also handy together with `clone()` to run the same query against another client without touching the original builder.

## Reusing and cloning a builder

`clone()` returns an independent builder with the same filter, options, `distinctOn` fields, `see` mode and `db`. Changes made to either one afterwards don't affect the other:

```typescript
const active = userRepository.createQueryBuilder().where({ active: true });

const total = await active.clone().getCount();
const firstPage = await active.clone().orderBy({ name: "asc" }).limit(10).getResult();
```

## Validation and errors

Arguments are validated as soon as they're passed to a chained method, not when the query runs. An invalid one throws a `VSRepoError` with `type: VSRepoErrorType.QUERY_BUILDER`, whose message starts with the offending argument, and leaves the builder unchanged. `limit` and `offset` must be non-negative integers; for the other methods the validation checks the shape of the argument.

```typescript
import { VSRepoError, VSRepoErrorType } from "vsrepo";

try {
    userRepository.createQueryBuilder().limit(-1);
} catch (error) {
    if (error instanceof VSRepoError && error.type === VSRepoErrorType.QUERY_BUILDER) {
        console.error(error.message); // [VSRepository] Error: limit: Invalid value: Expected >=0 but received -1
    }
}
```

Errors thrown by the adapter while the query runs (e.g. `VSRepoAdapterError`) are not wrapped — they reach you unchanged.

## Query builder logs

The builder uses the repository's logger, so it follows the same `logLevel` and `logSlowThresholdMs` (see [Logging](./logging.md#logging)):

- `DEBUG` traces every chained call and, for each terminal method, the resolved query: the `see` mode, the final `where` (already including the soft-delete filter) and the options sent to the adapter. The `db` is never logged.
- Every terminal method is timed as `run query builder <method>`: the duration is logged at `DEBUG` and promoted to `WARN` when it exceeds `logSlowThresholdMs`.
- Invalid arguments are logged at `ERROR` right before the `VSRepoError` is thrown.

For example, `.where({ active: true }).orderBy({ createdAt: "desc" }).limit(20).getResultAndCount()` on a repository with `softRemoveKey` prints this at `DEBUG` (timestamps and the lines of the chained calls omitted):

```text
[DEBUG] [UserRepositoryLogger] VSQueryBuilder: getResultAndCount
{
  "see": "active",
  "where": {
    "active": true,
    "deletedAt": null
  },
  "options": {
    "order": {
      "createdAt": "desc"
    },
    "pagination": {
      "limit": 20
    }
  }
}
[DEBUG] [UserRepositoryLogger] Starting to run query builder getResultAndCount...
[DEBUG] [UserRepositoryLogger] Took 0.11ms to run query builder getResultAndCount
```

[⬆️ Back to top](#top)

<a id="top"></a>

# Base methods, configuration & soft-delete

🇺🇸 English | [🇧🇷 Português](./base-methods.pt-BR.md)

[← Back to the table of contents](./README.md)

## Constructor options

`VSRepoOptions<Entity, PKType>`, passed to `super(...)` inside your repository's constructor:

| Option               | Type                | Description                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `adapter`            | `VSRepoAdapter<Entity>`  | **Required.** The adapter instance that translates repository calls into calls against the underlying ORM/database.                                                                                                                                                                                                                                                                                    |
| `pkName`             | `KeysOfType<Entity, PKType>`           | Optional. Name of the field that represents the entity's primary key. When omitted, the repository falls back to the adapter's `getPkName()`. If the adapter does not implement it either, the constructor throws a `VSRepoError`.                                                                                                                                                                     |
| `softRemoveKey`      | `keyof Entity`           | Optional. When set, enables `softRemove`, `softRemoveList`, `restore` and `restoreList`.                                                                                                                                                                                                                                                                                                               |
| `defaultOrdering`    | `Ordering<Entity>`       | Optional. Default ordering applied automatically to queries that accept `order`, unless overridden per call.                                                                                                                                                                                                                                                                                           |
| `logLevel`           | `VSLogLevel`        | Optional. Minimum severity printed by the internal logger. Defaults to `VSLogLevel.WARN`.                                                                                                                                                                                                                                                                                                              |
| `logSlowThresholdMs` | `number \| boolean` | Optional. Duration (ms) above which a finished operation is logged as `WARN`. Defaults to 300ms. Pass `false` to disable slow-operation warnings entirely; pass `true` to use the 300ms default explicitly.                                                                                                                                                                                            |
| `lazyDynamicMethods` | `boolean`           | Optional. Defaults to `false`. When `true`, postpones resolving `@DynamicMethod`/`@QueryMethod` methods — the repository itself must call `resolveDynamicMethods()` manually later. See [Lazily resolving dynamic methods](./dynamic-methods.md#lazily-resolving-dynamic-methods).                                                                                                                     |
| `vsPlaceholders`     | `boolean`           | Optional. Defaults to `false`. When `true`, raw SQL strings passed to `query()` and `@QueryMethod` use VSRepository's own placeholders (`?1`, `?2`, ...) instead of your adapter's native syntax. Requires the adapter to implement `getPlaceholder()`. See [Agnostic placeholders with `vsPlaceholders`](./query-methods.md#agnostic-placeholders-with-vsplaceholders). |

---

## Base methods

Available automatically on every `VSRepository` subclass:

| Method                                  | Description                                                                                                                                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get(pk, options?)`                     | Fetches a record by primary key.                                                                                                                                                                      |
| `getOrThrow(pk, options?)`              | Fetches a record by primary key, throwing if not found.                                                                                                                                               |
| `getList(pks, options?)`                | Fetches multiple records by a list of primary keys.                                                                                                                                                   |
| `getAll(options?)`                      | Fetches all records; accepts `pagination` and `order` in `options`.                                                                                                                                   |
| `save(obj, options?)`                   | Creates or updates (upsert) a single record.                                                                                                                                                          |
| `saveList(objs, options?)`              | Creates or updates (upsert) multiple records in one call.                                                                                                                                             |
| `patch(pk, obj, options?)`              | Partially updates a record by primary key.                                                                                                                                                            |
| `merge(pk, obj, options?)`              | Fetches a record and returns it deep-merged, in memory, with the given object — does **not** persist anything.                                                                                        |
| `remove(pk, options?)`                  | Deletes a record by primary key.                                                                                                                                                                      |
| `removeList(pks, options?)`             | Deletes multiple records by primary key, returning `{ count }`.                                                                                                                                       |
| `total(options?)`                       | Returns the total number of records.                                                                                                                                                                  |
| `has(pk, options?)`                     | Checks whether a record exists, returning `boolean`.                                                                                                                                                  |
| `increment(pk, field, value, options?)` | Atomically adds `value` to a numeric field. See [Atomic and aggregate methods](#atomic-and-aggregate-methods).                                                                                        |
| `decrement(pk, field, value, options?)` | Atomically subtracts `value` from a numeric field.                                                                                                                                                    |
| `multiply(pk, field, value, options?)`  | Atomically multiplies a numeric field by `value`.                                                                                                                                                     |
| `divide(pk, field, value, options?)`    | Atomically divides a numeric field by `value`.                                                                                                                                                        |
| `sum(field, where?, options?)`          | Sums a numeric field across every matching record; `null` if none match.                                                                                                                              |
| `average(field, where?, options?)`      | Arithmetic mean of a numeric field across every matching record; `null` if none match.                                                                                                                |
| `min(field, where?, options?)`          | Minimum value of a numeric field across every matching record; `null` if none match.                                                                                                                  |
| `max(field, where?, options?)`          | Maximum value of a numeric field across every matching record; `null` if none match.                                                                                                                  |
| `transaction(fn, options?)`             | Runs `fn` inside a native transaction of the underlying ORM.                                                                                                                                          |
| `getDbClient()`                         | Returns the ORM client instance.                                                                                                                                                                      |
| `query<T>(query, options?)`             | Executes a raw SQL statement directly against the database — accepts a plain string or a `VSSql` fragment. See [Ad-hoc raw queries with `query()`](./query-methods.md#ad-hoc-raw-queries-with-query). |
| `createQueryBuilder(db?)`               | Creates a fluent [query builder](./query-builder.md#query-builder) for queries assembled at runtime.                                                                                                  |
| `createRawQueryBuilder(db?)`            | Creates a fluent [raw query builder](./raw-query-builder.md#raw-query-builder) for hand-written `SELECT` queries too SQL-specific for the query builder — joins, subqueries, CTEs.                  |

Most of the above accept a `MethodOptions<Entity, OrmTypes>` object as their last argument (`select`, `relations`, `see`, `db`). A few — `total`, `has`, `removeList`, `sum`, `average`, `min`, `max`, and the soft-delete batch methods (`softRemoveList`/`restoreList`) — don't return/shape an `Entity`, so they accept the narrower `RestrictMethodOptions<Entity, OrmTypes>` instead (`see`, `db` only; no `select`/`relations`). `transaction`, `query`, and `getDbClient` accept their own options or none at all.

---

## Soft-delete

Soft-delete is a **first-class, built-in concept**. Configure `softRemoveKey` once on the repository:

```typescript
super({
    pkName: "id",
    adapter,
    softRemoveKey: "deletedAt",
});
```

This unlocks four extra methods:

| Method                          | Effect                                |
| ------------------------------- | ------------------------------------- |
| `softRemove(pk, options?)`      | Sets `deletedAt` to the current date. |
| `softRemoveList(pks, options?)` | Same, in batch — returns `{ count }`. |
| `restore(pk, options?)`         | Sets `deletedAt` back to `null`.      |
| `restoreList(pks, options?)`    | Same, in batch — returns `{ count }`. |

Every method accepts a `see` option controlling visibility of soft-deleted rows — including `softRemove`, `softRemoveList`, `restore` and `restoreList`:

```typescript
await userRepository.getAll({ see: "active" }); // default — only non-deleted records
await userRepository.getAll({ see: "removed" }); // only soft-deleted records
await userRepository.getAll({ see: "all" }); // everything, ignoring soft-delete
```

The default for `see` is `"active"` on every method, **except** `softRemove`, `softRemoveList`, `restore` and `restoreList`, whose default is `"all"` — so by default they find the record whether or not it is already removed (for example, `restore` has to find a record that is already soft-deleted):

```typescript
await userRepository.restore(id); // same as { see: "all" } — finds the record even if removed
await userRepository.restore(id, { see: "removed" }); // only restores it if it is soft-deleted
await userRepository.softRemove(id, { see: "active" }); // only removes it if it is still active
```

---

## Atomic and aggregate methods

Every `VSRepository` subclass gets 8 methods for working with numeric fields, split into two groups:

**Atomic updates** — evaluated server-side against the row's _current_ value (`UPDATE ... SET field = field + value`), not a client-side read-modify-write:

```typescript
await userRepository.increment("user-1", "balance", 50); // balance = balance + 50
await userRepository.decrement("user-1", "balance", 50); // balance = balance - 50
await userRepository.multiply("user-1", "balance", 2); // balance = balance * 2
await userRepository.divide("user-1", "balance", 4); // balance = balance / 4
```

All four return the updated `Entity` and accept the full `MethodOptions<Entity, OrmTypes>` (`select`, `relations`, `see`, `db`) as their last argument, same as `get`/`save`/`patch`.

**Aggregates** — computed across every record matching an (optional) `where`:

```typescript
await userRepository.sum("balance"); // total balance across every active record
await userRepository.sum("balance", { active: true }); // ...restricted by a where
await userRepository.average("balance");
await userRepository.min("balance");
await userRepository.max("balance");
```

All four return `number | null` — `null` when no record matches, mirroring SQL's `SUM()`/`AVG()`/`MIN()`/`MAX()`, which return `NULL` (not `0`) over an empty set. Unlike the atomic methods, they accept the narrower `RestrictMethodOptions<Entity, OrmTypes>` (`see`, `db` only — no `select`/`relations`, since the result is a plain number, not a shaped `Entity`).

Both groups respect `softRemoveKey`/`see` the same way every other base method does — `sum("balance")` only totals non-deleted records by default, pass `{ see: "all" }` or `{ see: "removed" }` to change that.

### Which fields are eligible

`field` is constrained to `NumericKeys<Entity>` — keys whose (non-nullable) value type is a `number`, a `bigint`, or a `DecimalLike` object:

```typescript
type Product = { id: string; name: string; price: Decimal; stock: number | null };

await productRepository.increment(id, "price", new Decimal(10.5)); // ok — Decimal-like
await productRepository.increment(id, "stock", 5); // ok — nullable numeric fields are included
await productRepository.increment(id, "name", 1); // compile error — "name" isn't numeric
```

`value` is typed as `NonNullable<Entity[Field]>` — it must match the field's own type exactly. A `Decimal` field expects a `Decimal` instance, not a plain `number`/`string`:

```typescript
await productRepository.increment(id, "price", new Decimal(10.5)); // ok
await productRepository.increment(id, "price", 10.5); // compile error — wrap it: new Decimal(10.5)
```

Note that several ORMs (Drizzle, MikroORM, TypeORM) represent `decimal`/`numeric` columns as plain `string` by default, to avoid floating-point precision loss — a `string` field does **not** satisfy `NumericKeys<Entity>` out of the box. Configure the column in a numeric mode (or a transformer) on those ORMs if you want the field to be usable with these 8 methods.

[⬆️ Back to top](#top)

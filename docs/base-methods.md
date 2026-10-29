<a id="top"></a>

# Base methods, configuration & soft-delete

🇺🇸 English | [🇧🇷 Português](./base-methods.pt-BR.md)

[← Back to the table of contents](./README.md)

## Constructor options

`VSRepoOptions<Entity, PKType>`, passed to `super(...)` inside your repository's constructor:

| Option               | Type                         | Description                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adapter`            | `VSRepoAdapter<Entity>`      | **Required.** The adapter instance that translates repository calls into calls against the underlying ORM/database.                                                                                                                                                                                                                                   |
| `pkName`             | `KeysOfType<Entity, PKType>` | Optional. Name of the field that represents the entity's primary key. When omitted, the repository falls back to the adapter's `getPkName()`. If the adapter does not implement it either, the constructor throws a `VSRepoError`.                                                                                                                    |
| `defaultOrdering`    | `Ordering<Entity>`           | Optional. Default ordering applied automatically to queries that accept `order`, unless overridden per call.                                                                                                                                                                                                                                          |
| `logLevel`           | `VSLogLevel`                 | Optional. Minimum severity printed by the internal logger. Defaults to `VSLogLevel.WARN`; use `VSLogLevel.NONE` to disable logging completely.                                                                                                                                                                                                        |
| `lazyDynamicMethods` | `boolean`                    | Optional. Defaults to `false`. When `true`, postpones resolving `@DynamicMethod`/`@QueryMethod` methods — the repository itself must call `resolveDynamicMethods()` manually later. See [Lazily resolving dynamic methods](./dynamic-methods.md#lazily-resolving-dynamic-methods).                                                                    |
| `vsPlaceholders`     | `boolean`                    | Optional. Defaults to `true`. Raw SQL strings passed to `query()` and `@QueryMethod` use VSRepository's own placeholders (`?1`, `?2`, ...) instead of your adapter's native syntax. Pass `false` to write the native syntax instead. See [Agnostic placeholders with `vsPlaceholders`](./query-methods.md#agnostic-placeholders-with-vsplaceholders). |
| `mergeConfig`        | `MergeConfig<Entity>`        | Optional. Default configuration used by `merge()`; a call can replace it through `options.mergeConfig`. See [Merging records with `merge`](#merging-records-with-merge).                                                           |

Soft-delete is no longer a constructor option — it's enabled with the [`@EnableSoftDelete`](#soft-delete) decorator.

### Global configuration

`VSRepository.setGlobalConfig()` sets defaults shared by every repository. Per-repository options take precedence, and only repositories created **after** the call are affected, so call it once at startup, before instantiating any repository:

```typescript
VSRepository.setGlobalConfig({
    logLevel: VSLogLevel.INFO,
    softDeleteField: "deletedAt",
    vsPlaceholders: true,
    lazyDynamicMethods: false,
});
```

| Field                | Description                                                                         |
| -------------------- | ----------------------------------------------------------------------------------- |
| `softDeleteField`    | Soft-delete field used by `@EnableSoftDelete()` when it doesn't specify one itself. |
| `logLevel`           | Default for the `logLevel` option.                                                  |
| `lazyDynamicMethods` | Default for the `lazyDynamicMethods` option.                                        |
| `vsPlaceholders`     | Default for the `vsPlaceholders` option.                                            |

---

## Base methods

Available automatically on every `VSRepository` subclass. `where` is a [`VSRepoWhere`](./utility-types.md) filter — the same one used by dynamic methods and the query builder.

**Reading**

| Method                             | Description                                                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `find(where?, options?)`           | Returns every record matching `where` (all records if omitted); accepts `pagination` and `order` in `options`.                            |
| `findAndCount(where?, options?)`   | Same as `find`, but also returns the total of matching records — see [Finding records and their total](#finding-records-and-their-total). |
| `findOne(where?, options?)`        | Returns the first record matching `where`, or `null`.                                                                                     |
| `findOneOrThrow(where?, options?)` | Same as `findOne`, but throws if nothing matches.                                                                                         |
| `get(id, options?)`                | Fetches a record by primary key, or `null`.                                                                                               |
| `getOrThrow(id, options?)`         | Fetches a record by primary key, throwing if not found.                                                                                   |
| `count(where?, options?)`          | Counts the records matching `where` (all records if omitted).                                                                             |
| `exists(where?, options?)`         | Checks whether at least one record matches `where`, returning `boolean`.                                                                  |
| `has(id, options?)`                | Checks whether a record with the given primary key exists, returning `boolean`.                                                           |

**Writing**

| Method                                      | Description                                                                                                                                                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create(obj, options?)`                     | Creates a record and returns it.                                                                                                                                                                                           |
| `createMany(objs, options?)`                | Creates several records at once, returning `{ count }`. Pass `ignoreConflicts: true` to skip rows that violate a unique constraint.                                                                                        |
| `createManyReturning(objs, options?)`       | Same as `createMany`, but returns the created records.                                                                                                                                                                     |
| `save(obj \| objs, options?)`               | Creates or updates (upsert) a record — or, given an array, several records in one call.                                                                                                                                    |
| `upsert(where, create, update, options?)`   | Updates the record matching `where` with `update`, or creates it with `create` if none matches.                                                                                                                            |
| `update(where, obj, options?)`              | Updates the record matching `where` and returns it.                                                                                                                                                                        |
| `updateMany(where, obj, options?)`          | Updates every record matching `where`, returning `{ count }`.                                                                                                                                                              |
| `updateManyReturning(where, obj, options?)` | Same as `updateMany`, but returns the updated records.                                                                                                                                                                     |
| `patch(id, obj, options?)`                  | Same as `update`, by primary key.                                                                                                                                                                                          |
| `merge(where, obj, options?)`               | Fetches the record matching `where` and returns it deep-merged, in memory, with the given object — does **not** persist anything; `null` if none matches. See [Merging records with `merge`](#merging-records-with-merge). |

**Deleting** (permanent — for soft-delete see [below](#soft-delete))

| Method                                 | Description                                                               |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `delete(where, options?)`              | Permanently deletes the record matching `where` and returns it.           |
| `remove(id, options?)`                 | Same as `delete`, by primary key.                                         |
| `deleteMany(where, options?)`          | Permanently deletes every record matching `where`, returning `{ count }`. |
| `deleteManyReturning(where, options?)` | Same as `deleteMany`, but returns the deleted records.                    |

**Numeric operations** — see [Atomic and aggregate methods](#atomic-and-aggregate-methods)

| Method                                                                                              | Description                                                                |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `increment(field, value, where, options?)`                                                          | Atomically adds `value` to a numeric field of the record matching `where`. |
| `decrement(field, value, where, options?)`                                                          | Atomically subtracts `value` from a numeric field.                         |
| `multiply(field, value, where, options?)`                                                           | Atomically multiplies a numeric field by `value`.                          |
| `divide(field, value, where, options?)`                                                             | Atomically divides a numeric field by `value`.                             |
| `incrementMany` / `decrementMany` / `multiplyMany` / `divideMany` `(field, value, where, options?)` | Same as above, for every record matching `where`, returning `{ count }`.   |
| `sum(field, where?, options?)`                                                                      | Sums a numeric field across every matching record; `null` if none match.   |
| `average(field, where?, options?)`                                                                  | Arithmetic mean of a numeric field; `null` if none match.                  |
| `min(field, where?, options?)`                                                                      | Minimum value of a numeric field; `null` if none match.                    |
| `max(field, where?, options?)`                                                                      | Maximum value of a numeric field; `null` if none match.                    |

**Infrastructure**

| Method                       | Description                                                                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transaction(fn, options?)`  | Runs `fn` inside a native transaction of the underlying ORM.                                                                                                                                          |
| `getDbClient()`              | Returns the ORM client instance.                                                                                                                                                                      |
| `getAdapter()`               | Returns the adapter, optionally typed as a specific adapter class (`getAdapter<MyAdapter>()`).                                                                                                        |
| `query<T>(query, options?)`  | Executes a raw SQL statement directly against the database — accepts a plain string or a `VSSql` fragment. See [Ad-hoc raw queries with `query()`](./query-methods.md#ad-hoc-raw-queries-with-query). |
| `createQueryBuilder(db?)`    | Creates a fluent [query builder](./query-builder.md#query-builder) for queries assembled at runtime.                                                                                                  |
| `createRawQueryBuilder(db?)` | Creates a fluent [raw query builder](./raw-query-builder.md#raw-query-builder) for hand-written `SELECT` queries too SQL-specific for the query builder — joins, subqueries, CTEs.                    |

```typescript
const active = await userRepository.find({ active: true }, { order: { name: "asc" }, pagination: { limit: 20 } });
const user = await userRepository.findOne({ email: "joao@email.com" });

await userRepository.create({ name: "Maria", email: "maria@email.com" });
await userRepository.save([{ name: "Ana" }, { name: "Bia" }]); // several records in one call
await userRepository.update({ email: "maria@email.com" }, { active: false });
await userRepository.deleteMany({ active: false });
```

### Finding records and their total

`findAndCount(where?, options?)` fetches the records matching `where` **and** the total number of matching records in a single call — the usual building block of a paginated listing. It resolves to a [`PaginatedResult`](./utility-types.md): `{ result: Entity[]; count: number }`.

- `result` honors `order`, `pagination` and the repository's `defaultOrdering` (just like `find`).
- `count` ignores `order` and `pagination` on purpose: it's the total of records matching `where`, so you can compute the number of pages.
- Both queries use the same resolved `where` (including the soft-delete/`see` filter) and the same `db`, and run one after the other.

```typescript
const pageSize = 20;

const { result, count } = await userRepository.findAndCount(
    { active: true },
    { order: { createdAt: "desc" }, pagination: { limit: pageSize, offset: 40 } },
);

const totalPages = Math.ceil(count / pageSize);
```

The same operation is available as a [dynamic method](./dynamic-methods.md#available-prefixes) (`findAndCountBy`, `findAndCountWhere`) and, for queries assembled at runtime, as [`getResultAndCount()`](./query-builder.md#pagination-with-getresultandcount) on the query builder.

### Merging records with `merge`

`merge(where, obj, options?)` fetches the record matching `where` and combines it, **in memory**, with `obj`. Nothing is persisted — pass the result to `save` or `patch` to write it. `defaultOrdering` is applied unless `options.order` is set, which matters when more than one record matches.

Without any configuration, every field of `obj` overwrites the stored one: nested objects and arrays are **replaced**, not merged; `undefined` values are skipped; and `null` values are written. The fetched record is the one mutated and returned, and `obj` is never modified.

To change this, pass a [`MergeConfig`](./utility-types.md) — in the repository's constructor options (`mergeConfig`, for every call) or in the method options (`options.mergeConfig`, for that call only). The one in the method options **replaces** the repository's, it isn't combined with it.

| Field               | Default    | Description                                                                                                                                                                          |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `undefinedBehavior` | `"ignore"` | `"ignore"` skips source fields whose value is `undefined`, keeping the stored value; `"keep"` writes the `undefined`.                                                                |
| `nullBehavior`      | `"keep"`   | `"keep"` writes source fields whose value is `null`; `"ignore"` skips them, keeping the stored value.                                                                                |
| `fields`            | none       | Per-field strategies, by field name. Fields that aren't listed are overwritten by the source value. `undefinedBehavior` and `nullBehavior` also apply to the nested entities merged. |

Each entry of `fields` picks a `strategy`. Only the strategies that fit the field's type are accepted:

| Strategy  | Field type        | Behavior                                                                                                                                                                                                                                                                      | Extra options                                                                    |
| --------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `to-one`  | Nested entity     | Merges the source object **recursively** into the stored one instead of replacing it.                                                                                                                                                   | `fields` — strategies for the nested entity (default: none).                     |
| `to-many` | Array of entities | Matches the items of both lists by `pk`: matched items are merged recursively, items only in the stored list are kept and items only in the source list are appended. Items without a `pk` value can't be matched: the stored ones are kept and the source ones are appended. | `pk` (**required**); `fields` — strategies for each item (default: none).        |
| `concat`  | Array of scalars  | Concatenates the stored and the source lists, without removing duplicates.                                                                                                                                                                                                    | `whosFirst`: `"target"` (stored items first) or `"source"`. Default: `"target"`. |
| `custom`  | Any field         | Stores what `customFn(target, source)` returns. It's only called when the source value isn't `null` or `undefined` (those follow `nullBehavior`/`undefinedBehavior`), and `target` may be `undefined`.                                                                        | `customFn` (**required**).                                                       |

```typescript
const user = await userRepository.merge(
    { id: "1" },
    { name: "Maria", tags: ["admin"], address: { city: "Recife" }, posts: [{ id: 2, title: "Edited" }] },
    {
        relations: { address: true, posts: true },
        mergeConfig: {
            nullBehavior: "ignore",
            fields: {
                tags: { strategy: "concat", whosFirst: "source" },
                address: { strategy: "to-one" },
                posts: { strategy: "to-many", pk: "id" },
            },
        },
    },
);

if (user) await userRepository.save(user);
```

The record is fetched with the `select`/`relations` from the options, so load the relations you want to merge into: without them there is nothing to match against.

### Method options

Most methods accept an options object as their last argument, with a shape that depends on the method:

| Type                                      | Fields                                                                   | Used by                                                                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MethodOptions<Entity, OrmTypes>`         | `select`, `relations`, `see`, `db`, `pagination`, `order`                | `find`, `findAndCount`, `findOne`, `findOneOrThrow`, `get`, `getOrThrow` — the read methods, which also apply `defaultOrdering` unless `order` is passed.                                                        |
| `SimpleMethodOptions<Entity, OrmTypes>`   | `select`, `relations`, `see`, `db`                                       | Single-record methods that return an `Entity` — `save`, `create`, `update`, `patch`, `upsert`, `delete`, `remove`, `increment`, ..., the `*Returning` methods and the soft-delete single-record methods.         |
| `MergeOptions<Entity, OrmTypes>`          | `select`, `relations`, `see`, `db`, `pagination`, `order`, `mergeConfig` | `merge` — the same fetch options as `MethodOptions`, plus `mergeConfig`.                                                                                                                                         |
| `RestrictMethodOptions<Entity, OrmTypes>` | `see`, `db`                                                              | Methods that don't return a shaped `Entity` — `count`, `exists`, `has`, `createMany`, `updateMany`, `deleteMany`, `sum`, `average`, `min`, `max`, the `*Many` numeric methods and the soft-delete batch methods. |

`createMany` and `createManyReturning` also accept `ignoreConflicts`. `transaction`, `query` and `getDbClient` accept their own options or none at all.

---

## Soft-delete

Soft-delete is a **first-class, built-in concept**, enabled per repository with the `@EnableSoftDelete` class decorator. Pass the (nullable date) field that marks a record as deleted:

```typescript
@EnableSoftDelete("deletedAt")
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ pkName: "id", adapter });
    }
}
```

If the field is the same across your repositories, set it once with `VSRepository.setGlobalConfig({ softDeleteField: "deletedAt" })` and use `@EnableSoftDelete()` with no argument. Enabling soft-delete without a field — in the decorator or globally — makes the constructor throw a `VSRepoError`.

This unlocks six extra methods:

| Method                            | Effect                                                       |
| --------------------------------- | ------------------------------------------------------------ |
| `softDelete(where, options?)`     | Sets `deletedAt` to the current date on the matching record. |
| `softRemove(id, options?)`        | Same as `softDelete`, by primary key.                        |
| `softDeleteMany(where, options?)` | Same, in batch — returns `{ count }`.                        |
| `restore(where, options?)`        | Sets `deletedAt` back to `null` on the matching record.      |
| `recover(id, options?)`           | Same as `restore`, by primary key.                           |
| `restoreMany(where, options?)`    | Same, in batch — returns `{ count }`.                        |

Calling any of them on a repository without `@EnableSoftDelete` throws a `VSRepoError`. `delete`, `remove` and the other delete methods stay **permanent**, even with soft-delete enabled.

Every method accepts a `see` option controlling visibility of soft-deleted rows — including the six methods above:

```typescript
await userRepository.find({}, { see: "active" }); // default — only non-deleted records
await userRepository.find({}, { see: "removed" }); // only soft-deleted records
await userRepository.find({}, { see: "all" }); // everything, ignoring soft-delete
```

The default for `see` is `"active"` on every method, **except** the six soft-delete methods, whose default is `"all"` — so by default they find the record whether or not it is already removed (for example, `restore` has to find a record that is already soft-deleted):

```typescript
await userRepository.recover(id); // same as { see: "all" } — finds the record even if removed
await userRepository.recover(id, { see: "removed" }); // only restores it if it is soft-deleted
await userRepository.softRemove(id, { see: "active" }); // only removes it if it is still active
```

---

## Atomic and aggregate methods

Every `VSRepository` subclass gets methods for working with numeric fields, split into two groups:

**Atomic updates** — evaluated server-side against the row's _current_ value (`UPDATE ... SET field = field + value`), not a client-side read-modify-write. The record is selected by a `where`:

```typescript
await userRepository.increment("balance", 50, { id: "user-1" }); // balance = balance + 50
await userRepository.decrement("balance", 50, { id: "user-1" }); // balance = balance - 50
await userRepository.multiply("balance", 2, { id: "user-1" }); // balance = balance * 2
await userRepository.divide("balance", 4, { id: "user-1" }); // balance = balance / 4
```

All four return the updated `Entity` and accept `SimpleMethodOptions<Entity, OrmTypes>` (`select`, `relations`, `see`, `db`) as their last argument.

Each one has a `*Many` variant that applies the operation to **every** record matching `where` and returns `{ count }`, accepting `RestrictMethodOptions<Entity, OrmTypes>` (`see`, `db`):

```typescript
await productRepository.incrementMany("stock", 10, { category: "books" }); // { count: 42 }
await productRepository.multiplyMany("price", 1.1, {}); // every active product
```

**Aggregates** — computed across every record matching an (optional) `where`:

```typescript
await userRepository.sum("balance"); // total balance across every active record
await userRepository.sum("balance", { active: true }); // ...restricted by a where
await userRepository.average("balance");
await userRepository.min("balance");
await userRepository.max("balance");
```

All four return `number | null` — `null` when no record matches, mirroring SQL's `SUM()`/`AVG()`/`MIN()`/`MAX()`, which return `NULL` (not `0`) over an empty set. They accept `RestrictMethodOptions<Entity, OrmTypes>` (`see`, `db` only — no `select`/`relations`, since the result is a plain number, not a shaped `Entity`).

Both groups respect soft-delete/`see` the same way every other base method does — `sum("balance")` only totals non-deleted records by default, pass `{ see: "all" }` or `{ see: "removed" }` to change that.

### Which fields are eligible

`field` is constrained to `NumericKeys<Entity>` — keys whose (non-nullable) value type is a `number`, a `bigint`, or a `DecimalLike` object:

```typescript
type Product = { id: string; name: string; price: Decimal; stock: number | null };

await productRepository.increment("price", new Decimal(10.5), { id }); // ok — Decimal-like
await productRepository.increment("stock", 5, { id }); // ok — nullable numeric fields are included
await productRepository.increment("name", 1, { id }); // compile error — "name" isn't numeric
```

`value` is typed as `NonNullable<Entity[Field]>` — it must match the field's own type exactly. A `Decimal` field expects a `Decimal` instance, not a plain `number`/`string`:

```typescript
await productRepository.increment("price", new Decimal(10.5), { id }); // ok
await productRepository.increment("price", 10.5, { id }); // compile error — wrap it: new Decimal(10.5)
```

Note that several ORMs (Drizzle, MikroORM, TypeORM) represent `decimal`/`numeric` columns as plain `string` by default, to avoid floating-point precision loss — a `string` field does **not** satisfy `NumericKeys<Entity>` out of the box. Configure the column in a numeric mode (or a transformer) on those ORMs if you want the field to be usable with these methods.

[⬆️ Back to top](#top)

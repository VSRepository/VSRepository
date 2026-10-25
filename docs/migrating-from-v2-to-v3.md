<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./migrating-from-v2-to-v3.pt-BR.md)

[← Back to the table of contents](./README.md)

# Migrating from v2 to v3

> [!NOTE]
>
> v3 is still in development (`3.0.0-dev`). This page describes the current state of the `v3` branch and may still change before the stable release.

v2 introduced the ORM-agnostic core; v3 keeps that architecture and reshapes the API on top of it: base methods now mirror the dynamic-method vocabulary (`find`, `create`, `update`, `delete`, `count`, `exists`, ...), soft-delete became a decorator, dynamic methods lost the features that never belonged to a name-parsing engine (`create*`, `Distinct`, `IgnoreConflicts`), `@QueryMethod` takes plain positional arguments, and the library stopped validating at runtime what TypeScript already checks.

If you're coming from v1, read [Migrating from v1 to v2](./migrating-from-v1-to-v2.md) first.

## Requirements and packaging

| Area                | v2                                                         | v3                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js             | 18+                                                        | **22+**                                                                                                                                                                    |
| Module format       | CommonJS package                                           | **ESM package** (`"type": "module"`). |
| Runtime validation  | `valibot` validates options, arguments and `where` objects | **Removed** — validation is type-level only, and `valibot` is no longer a dependency. The `DECORATOR` and `VALIDATOR` error types went away with it.                       |
| Slow-operation logs | `logSlowThresholdMs` and `WARN` slow-operation lines       | **Removed** — durations are only logged at `DEBUG`.                                                                                                                        |

## Base methods

The base methods were reworked around `where` filters instead of primary-key lists. Methods that took a `pk` still exist when they make sense (`get`, `remove`, `patch`, `has`, ...).

| v2                                                                                                           | v3                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `getAll(options?)`                                                                                           | `find(where?, options?)` — also accepts `pagination` and `order`                                                                     |
| `getList(pks, options?)`                                                                                     | `find({ id: { in: pks } }, options?)`                                                                                                |
| `saveList(objs, options?)`                                                                                   | `save(objs, options?)` — `save` now accepts an array                                                                                 |
| `removeList(pks, options?)`                                                                                  | `deleteMany({ id: { in: pks } }, options?)`                                                                                          |
| `total(options?)`                                                                                            | `count(where?, options?)`                                                                                                            |
| `softRemoveList(pks, options?)`                                                                              | `softDeleteMany(where, options?)`                                                                                                    |
| `restore(pk, options?)`                                                                                      | `recover(id, options?)` — `restore` now takes a `where`                                                                              |
| `restoreList(pks, options?)`                                                                                 | `restoreMany(where, options?)`                                                                                                       |
| `increment(pk, field, value, options?)` (and `decrement`, `multiply`, `divide`)                              | `increment(field, value, where, options?)` — selected by a `where`, plus `incrementMany`/`decrementMany`/`multiplyMany`/`divideMany` |
| `get`, `getOrThrow`, `save`, `remove`, `patch`, `merge`, `has`, `softRemove`, `sum`, `average`, `min`, `max` | Still there, same names (`get`/`getOrThrow` also accept `order`/`pagination` now)                                                    |

New base methods: `find`, `findOne`, `findOneOrThrow`, `create`, `createMany`, `createManyReturning`, `upsert`, `update`, `updateMany`, `updateManyReturning`, `delete`, `deleteMany`, `deleteManyReturning`, `count`, `exists`, `softDelete`, `softDeleteMany`, `restore`, `restoreMany`, plus the static `VSRepository.setGlobalConfig()`, `getQueryBuilder()` and `getRawQueryBuilder()`, and the instance `getAdapter()`. See [Base methods](./base-methods.md).

The options types were also refined: `MethodOptions` gained `pagination` and `order`, and the new `SimpleMethodOptions` (no `pagination`/`order`) is what single-record methods accept — see [Method options](./base-methods.md#method-options).

## Soft-delete

The `softRemoveKey` constructor option is gone. Soft-delete is now enabled with the `@EnableSoftDelete` class decorator:

```typescript
// v2
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ adapter, pkName: "id", softRemoveKey: "deletedAt" });
    }
}

// v3
@EnableSoftDelete("deletedAt")
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ adapter, pkName: "id" });
    }
}
```

Use `@EnableSoftDelete()` with no argument plus `VSRepository.setGlobalConfig({ softDeleteField: "deletedAt" })` to share one field across repositories. See [Soft-delete](./base-methods.md#soft-delete).

## Dynamic methods

- **`create*` prefixes removed** (`createBy…`, `createMany…`, `createManyReturning…`) — use the base methods `create`, `createMany` and `createManyReturning`.
- **`IgnoreConflicts` suffix removed** — pass `ignoreConflicts: true` to `createMany`/`createManyReturning`.
- **`Distinct<Fields>` suffix removed**, together with `distinct` on the query builder — there's no distinct support in the core anymore; use [`selectDistinct()`](./raw-query-builder.md#building-the-query) on the raw query builder.
- **`Optional` keyword removed.**
- **`order`/`pagination` through `options`** — dynamic methods now forward `options.order` and `options.pagination` to the adapter, so a plain `findByActive(active, options?)` can be ordered and paginated per call. See [Ordering and pagination](./dynamic-methods.md#ordering-and-pagination).
- **New filter aliases** — `Is` prefix (`IsBetween`, `IsIn`, `IsNull`, ...), `Equal`/`NotEqual`, `Containing`, `StartingWith`, `EndingWith`, `IgnoringCase`, `Gt`/`Gte`/`Lt`/`Lte`, `After`/`Before`, `True`/`False`/`Null`/`NotNull`, and the new `Like`/`NotLike` filters (`like` in `VSRepoWhere`). See [Field filters](./dynamic-methods.md#field-filters).
- **Relation keywords** (`With`, `Without`, `Some`, `Every`, `None`) are no longer recognized at the very start of a field name, so `findByWithDependents` resolves to the field `withDependents`.

## Query methods and raw SQL

- **`spreadArgs`/`singleArg` and the `QueryArgs`/`QueryMethodArg` types are gone.** `@QueryMethod` always receives plain positional arguments, and `withDb(tx)` is still the optional last argument:

    ```typescript
    // v2 (default: a single `{ args, db }` object)
    @QueryMethod('SELECT * FROM "user" WHERE email = $1')
    declare findByEmail: (arg: QueryMethodArg<[email: string]>) => Promise<User[]>;
    await repo.findByEmail({ args: ["joao@email.com"] });

    // v3
    @QueryMethod('SELECT * FROM "user" WHERE email = ?1')
    declare findByEmail: (email: string, db?: DbArg) => Promise<User[]>;
    await repo.findByEmail("joao@email.com");
    ```

- **`vsPlaceholders` is on by default** — raw SQL strings use `?1`, `?2`, ... Pass `vsPlaceholders: false` (constructor or `setGlobalConfig`) to keep writing your database's native syntax (`$1`, `?`).
- **`getPlaceholder()` is required in adapters** (see [Adapters](#adapters)), and the library ships the ready-made `getPostgresPlaceholder`, `getSqlitePlaceholder`, `getMySqlPlaceholder`, `getSqlServerPlaceholder`, `getCockroachPlaceholder` and `getVsPlaceholder`, typed by `GetPlaceholderFn`.
- **`VSSql`** errors now have `type: VSRepoErrorType.VSSQL`, and `compile()` defaults to `getVsPlaceholder`.

## Query builders

- `VSQueryBuilder.setDb()` and `VSRawQueryBuilder.setDb()` now **return the builder** (`qb.setDb(tx).getResult()`).
- `VSQueryBuilder.distinctOn()` was removed; `getCount()` sends only the `where`.
- `VSRawQueryBuilder` gained `selectDistinct()`, and `orderBy()` accepts a list of `[column, direction]` tuples. Generated SQL keywords are lowercase.

## Configuration, logging and errors

- `VSRepository.setGlobalConfig({ softDeleteField, logLevel, lazyDynamicMethods, vsPlaceholders })` sets shared defaults — see [Global configuration](./base-methods.md#global-configuration).
- `VSLogLevel.NONE` disables logging completely; `logSlowThresholdMs` was removed.
- `TransactionIsolationLevel` was renamed to **`VSRepoIsolationLevel`**, and `isolationLevel` also accepts the enum's string values (`"Serializable"`).
- `VSRepoErrorType.DECORATOR` and `VSRepoErrorType.VALIDATOR` were removed; `VS_PLACEHOLDERS` and `VSSQL` were added — see [Error handling](./error-handling.md).
- `resolveDynamicMethods()` only warns once when called more than once, and the resolver only logs the methods it resolves when there is at least one.
- New utility types: `ClientOrTransaction`, `SimpleMethodOptions`, `VSRepoGlobalConfig`, `VSRepoLogicalOperators`, `GetPlaceholderFn`. The typing of `VSRepoWhere` has been refactored.

## Adapters

The `VSRepoAdapter` contract changed, so **adapters built for v2 must be updated** before they work with v3. If you maintain one, implement:

1. `getPlaceholder(index)` — now **required** (return one of the exported helpers, or your own).
2. The new/changed methods: `findOne`/`findOneOrThrow`/`findMany` receive `order` and `pagination` (and no longer `distinct`); `incrementMany`, `decrementMany`, `multiplyMany` and `divideMany`; and options typed by `AdapterMethodOptions`, `SimpleAdapterMethodOptions` and `RestrictAdapterMethodOptions`.

See [Writing your own adapter](./writing-an-adapter.md#the-vsrepoadapter-contract) for the full contract. If you use an official adapter, install the release that declares compatibility with v3.

## Migrating a v2 repository to v3

1. **Update** Node.js to 22+ and install the v3-compatible version of your adapter.
2. **Replace** `softRemoveKey: "..."` with `@EnableSoftDelete("...")` (or a global `softDeleteField`).
3. **Rename** the removed base methods as listed [above](#base-methods): `getAll` → `find`, `getList` → `find` with `in`, `saveList` → `save([...])`, `removeList` → `deleteMany`, `total` → `count`, `softRemoveList` → `softDeleteMany`, `restore(pk)` → `recover(id)`, `restoreList` → `restoreMany`.
4. **Reorder** the arguments of `increment`/`decrement`/`multiply`/`divide`: `(field, value, where)`.
5. **Remove** `create*` dynamic methods, `IgnoreConflicts`, `Distinct` and `Optional` — use `create`/`createMany`/`createManyReturning` (with `ignoreConflicts`) and `selectDistinct()` where needed.
6. **Rewrite** `@QueryMethod` declarations to take positional arguments, use `?1`, `?2`, ... placeholders (or set `vsPlaceholders: false`), and drop `spreadArgs`/`QueryArgs`/`QueryMethodArg`.
7. **Rename** `TransactionIsolationLevel` to `VSRepoIsolationLevel`.
8. **Drop** `logSlowThresholdMs` and any handling of the `DECORATOR`/`VALIDATOR` error types.
9. **Check** places that relied on runtime validation errors — invalid shapes now only fail at compile time.
10. **Run** your TypeScript build and tests: most remaining issues show up as type errors.

> See the [main README](../README.md) for installation, adapter status, and basic usage.

[⬆️ Back to top](#top)

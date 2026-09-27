<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./migrating-from-v1.pt-BR.md)

[← Back to the table of contents](./README.md)

# Migrating from v1

v1 was the original, **Prisma-only** release of VSRepository. v2 — the current version — is a rewrite that made the core **ORM-agnostic**: instead of talking to Prisma directly, every operation is delegated to a pluggable `VSRepoAdapter`, so the same repository API works against Prisma, Drizzle, or any other ORM/database that implements the adapter contract.

The v1 source code and documentation live on the dedicated [`v1` branch](https://github.com/jaobrabo123/VSRepository/tree/v1), for anyone who still needs the previous Prisma-only release.

This page is the single reference for what changed between v1 and v2. If you're migrating an existing v1 repository, the [quick walkthrough](#migrating-a-v1-repository-to-v2) below summarizes the steps; the [full comparison table](#v1-vs-v2-comparison) covers every area in detail.

## v1 vs v2 comparison

| Area                                         | v1                                                                                                                                                                                                   | v2                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database access                              | Talks to **Prisma** directly, bundled in the core package                                                                                                                                            | Talks to a **`VSRepoAdapter`**; ORM support ships as separate packages (`@vsrepo/prisma7-adapter`, `@vsrepo/drizzle-adapter`, ...) instead of being bundled in the core `vsrepo` package                                                                                                                                                                                      |
| Defining a repository                        | Functional `setupVSRepo<T, M>()({...}).build(prisma)`, **or** a `DynamicRepository` class                                                                                                            | A single **class-based** API: `extends VSRepository<Entity, PKType, OrmTypes>`                                                                                                                                                                                                                                                                                                |
| Dynamic methods                              | `methods: { findByEmail: { map: true } }` config object                                                                                                                                              | `@DynamicMethod()` decorator on a `declare` field                                                                                                                                                                                                                                                                                                                             |
| Method & config options                      | `map`, `fbMode`, `whereType`, `selectModel`, `pushWhere`, `injectPagination` and per-method `query` in `methods: {...}`; `baseMethods: { active, defaultSelect, ignoreRequiredWhere }` at build time | Only `proxyTo` + `injectOrdering` remain on `@DynamicMethod` (see [Decorator options](./dynamic-methods.md#decorator-options)); `baseMethods` is no longer configurable — base methods are always active                                                                                                                                                                      |
| Data projections                             | Named, reusable `selectModels` + `defaultSelectModel`                                                                                                                                                | Ad-hoc `select`/`relations` passed per call (no named models)                                                                                                                                                                                                                                                                                                                 |
| Eager loading                                | `include`/`includeModels` (Prisma-specific)                                                                                                                                                          | ORM-agnostic `relations` option                                                                                                                                                                                                                                                                                                                                               |
| Global filters                               | `requiredWhere` and `pushWhere`                                                                                                                                                                      | **Removed**; only `softRemoveKey` + `see: "active" \| "removed" \| "all"` remain                                                                                                                                                                                                                                                                                              |
| Case-insensitive filter suffix               | `Insensitive`                                                                                                                                                                                        | `IgnoreCase`                                                                                                                                                                                                                                                                                                                                                                  |
| Inline ordering in method name               | Not supported (`order` had to be passed as an argument via `Ordered`)                                                                                                                                | `OrderBy<Field>Asc`/`OrderBy<Field>Desc` chains baked directly into the method name                                                                                                                                                                                                                                                                                           |
| Duplicate handling on `createMany`           | `SkipDuplicates` suffix                                                                                                                                                                              | `IgnoreConflicts` suffix                                                                                                                                                                                                                                                                                                                                                      |
| `aggregate` / `groupBy`                      | Supported (Prisma-native passthrough)                                                                                                                                                                | `groupBy` is **not planned** for v2. `aggregate` as a prefix is also unlikely: the most common operations are already covered by dedicated base methods (`sum`, `average`, `min`, `max`, `increment`, `decrement`, `multiply`, `divide`) — see [Atomic and aggregate methods](./base-methods.md#atomic-and-aggregate-methods). For anything more complex, use `@QueryMethod`. |
| Error types                                  | `VSRepoError` + subclasses (`VSRepoConfigError`, `VSRepoBuildError`, `VSRepoExtendError`, `VSRepoRuntimeError`)                                                                                      | A base `VSRepoError` class with a `type: VSRepoErrorType` field (`DECORATOR`, `RESOLVER`, `DYNAMIC`, `VALIDATOR`, `BASE`, `ADAPTER`, `QUERY_BUILDER`), plus a `VSRepoAdapterError` subclass carrying an `AdapterErrorCode` and the original ORM error                                                                                                                         |
| Debug logging                                | `showWorking: true` boolean                                                                                                                                                                          | `logLevel: VSLogLevel` (`DEBUG`/`INFO`/`WARN`/`ERROR`) + `logSlowThresholdMs` for slow-query warnings                                                                                                                                                                                                                                                                         |
| `vsrepo generate` CLI (type generation step) | Required before use                                                                                                                                                                                  | Not part of the v2 core — types come directly from your entity/ORM types                                                                                                                                                                                                                                                                                                      |
| CRUD extras                                  | `patchList`, raw `options.select`/`options.include`                                                                                                                                                  | `select`/`relations` are the default (always "raw"); `patch`/`merge` keep the same semantics. **`patchList` was removed** — for a batch partial update, use a `updateManyWhere`/`updateManyReturningWhere` dynamic method instead                                                                                                                                             |
| Soft-delete config                           | `softRemovekName` (sic — the original v1 config name)                                                                                                                                                | `softRemoveKey`                                                                                                                                                                                                                                                                                                                                                               |
| Accessing the ORM client                     | `repository.prisma`                                                                                                                                                                                  | `getDbClient()`                                                                                                                                                                                                                                                                                                                                                               |
| Extending a repository                       | `.extend({ ... })` (mixin)                                                                                                                                                                           | Define methods directly on the class (plain class inheritance/composition)                                                                                                                                                                                                                                                                                                    |
| Query methods                                | `query` config option (functional API) + `@QueryMethod('SQL', { modifying })` decorator                                                                                                              | `@QueryMethod` decorator only — adds `singleResult` and `spreadArgs` — plus a new ad-hoc `query()` method                                                                                                                                                                                                                                                                     |

## Renamed suffixes

Two suffix names changed between v1 and v2 — the feature is identical, only the name differs:

| v1               | v2                | Where it's used                                                                                                                      |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Insensitive`    | `IgnoreCase`      | Case-insensitive combinator for text filters in [dynamic methods](./dynamic-methods.md#field-filters)                                |
| `SkipDuplicates` | `IgnoreConflicts` | Duplicate handling on `createMany`/`createManyReturning` in [dynamic methods](./dynamic-methods.md#ordering-pagination-and-distinct) |

## Renamed dynamic-method prefixes

Several v1 method-name prefixes were renamed — or removed — for consistency with the v2 base methods:

| v1                         | v2                         |
| -------------------------- | -------------------------- |
| `findMany` / `findManyBy`  | `findBy` / `findWhere`     |
| `findFirst`                | `findOne`                  |
| `findFirstBy`              | `findOneBy`                |
| `findFirstOrThrow`         | `findOneOrThrow`           |
| `findFirstOrThrowBy`       | `findOneOrThrowBy`         |
| `findListWhere`            | `findWhere`                |
| `findOneWhere`             | `findOneWhere` (unchanged) |
| `createManyAndReturn`      | `createManyReturning`      |
| `updateManyAndReturnBy`    | `updateManyReturningBy`    |
| `updateManyAndReturnWhere` | `updateManyReturningWhere` |

The `fbMode` option — which let v1's `findBy` return the first match instead of a list — was removed. In v2 `findBy` always returns a list; use `findOneBy` for a single record.

**Removed** (no equivalent): `findUniqueBy` and `findUniqueOrThrowBy` — use `findOneBy`/`findOneOrThrowBy` instead.

**New in v2** (did not exist in v1): `findOneOrThrow`, `findOneOrThrowWhere`, `updateWhere`, `upsertWhere`, `deleteWhere`, and `deleteManyReturning*`. See [Available prefixes](./dynamic-methods.md#available-prefixes).

## Removed features

- **`patchList`** — removed. For a batch partial update, use a `updateManyWhere`/`updateManyReturningWhere` dynamic method instead.
- **`requiredWhere` / `pushWhere`** — removed. Only `softRemoveKey` + `see` remain.
- **`selectModels` / `defaultSelectModel` (named projections)** — removed. Pass `select`/`relations` per call instead (see [`select` and `relations`](./select-and-relations.md#select-and-relations)).
- **`includeModels`** — removed together with the named projections. Use the `relations` option per call instead.
- **`vsrepo generate` CLI** — no longer part of the core; types come from your entity/ORM types directly.
- **Dynamic-method config options** — `map`, `fbMode`, `whereType`, `selectModel`, `pushWhere`, `injectPagination` and the functional `query` option were removed. Only `proxyTo` and `injectOrdering` remain (see [Decorator options](./dynamic-methods.md#decorator-options)).
- **`baseMethods` configuration** (`active`, `defaultSelect`, `ignoreRequiredWhere`) — removed; base methods are always active.
- **`findUniqueBy` / `findUniqueOrThrowBy`** — removed; use `findOneBy`/`findOneOrThrowBy`.

## Where each concept now lives

| v1 concept                                | v2 replacement                                                       | Current guide                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `setupVSRepo` / `DynamicRepository`       | `extends VSRepository<Entity, PKType, OrmTypes>`                     | [Base methods, configuration & soft-delete](./base-methods.md)                                      |
| `methods: {...}` config                   | `@DynamicMethod()` decorator                                         | [Dynamic methods](./dynamic-methods.md)                                                             |
| `options.select` / `options.include` raw  | `select` / `relations` per call                                      | [`select` and `relations`](./select-and-relations.md)                                               |
| `showWorking: true`                       | `logLevel` + `logSlowThresholdMs`                                    | [Logging](./logging.md)                                                                             |
| `repository.prisma`                       | `getDbClient()`                                                      | [Base methods](./base-methods.md)                                                                   |
| `.extend({ ... })`                        | Plain class methods (inherit or compose)                             | [Dynamic methods](./dynamic-methods.md)                                                             |
| `query` config option / `@QueryMethod`    | `@QueryMethod` decorator + ad-hoc `query()`                          | [Query methods](./query-methods.md)                                                                 |
| `prisma.$transaction(...)` + `{ db: tx }` | `transaction(fn)` (the `db` option is still supported)               | [Transactions](./transactions.md), [Base methods](./base-methods.md)                                |
| `VSRepoConfigError` + subclasses          | `VSRepoError` + `type` field, `VSRepoAdapterError`                   | [Error handling](./error-handling.md)                                                               |
| Prisma `aggregate`/`groupBy` passthrough  | Base methods (`sum`, `average`, `min`, `max`, ...) or `@QueryMethod` | [Base methods](./base-methods.md#atomic-and-aggregate-methods), [Query methods](./query-methods.md) |

## What v2 adds

These capabilities did not exist in v1 — worth knowing while migrating:

- **`transaction(fn)`** — a first-class base method that runs `fn` inside a native ORM transaction. In v1 you had to pass `{ db: tx }` manually through `prisma.$transaction` (see [Transactions](./transactions.md)).
- **Atomic & aggregate base methods** — `increment`, `decrement`, `multiply`, `divide`, `sum`, `average`, `min`, `max` out of the box (see [Atomic and aggregate methods](./base-methods.md#atomic-and-aggregate-methods)).
- **Ad-hoc raw queries** — `query(sql, options?)` executes arbitrary SQL on demand (see [Ad-hoc raw queries with `query()`](./query-methods.md#ad-hoc-raw-queries-with-query)).
- **Query builder** — `createQueryBuilder()` assembles queries fluently at runtime, overriding filters/ordering/page settings per call (see [Query builder](./query-builder.md)).
- **New utility types** — `InferMethodReturn`, `InferMethodType`, `KeysOfType`, `Ordering`, `DeepPartial`, `VSRepoWhere` (see [Utility types](./utility-types.md)).

## Migrating a v1 repository to v2

1. **Install** the core package plus an adapter for your ORM — e.g. `npm i vsrepo @vsrepo/prisma7-adapter`.
2. **Replace** `setupVSRepo<T, M>()({...}).build(prisma)` (or a `DynamicRepository` class) with a class extending `VSRepository<Entity, PKType, OrmTypes>`.
3. **Move** your `methods: {...}` config to `@DynamicMethod()` decorators on `declare`d fields.
4. **Rename** the method-name prefixes to their v2 equivalents — `findMany`/`findFirst*`/`findListWhere`/`createManyAndReturn`/`updateManyAndReturn*` as listed [above](#renamed-dynamic-method-prefixes), and drop `findUniqueBy`/`findUniqueOrThrowBy`.
5. **Remove** the config options that no longer exist — `map`, `fbMode`, `whereType`, `selectModel`, `pushWhere`, `injectPagination`, `query`, and the `baseMethods` toggles. Only `proxyTo`/`injectOrdering` remain.
6. **Swap** `.extend()` calls for direct class methods, `repository.prisma` for `getDbClient()`, and `softRemovekName` for `softRemoveKey`.
7. **Move** any `query` config (functional API) or standalone `@QueryMethod` functions to the v2 `@QueryMethod` decorator, adding `singleResult`/`spreadArgs` where needed; use the new ad-hoc `query()` method for one-off SQL.
8. **Replace** `selectModels`/`defaultSelectModel` (and raw `options.select`/`options.include`) with per-call `select`/`relations`.
9. **Rename** the suffixes: `Insensitive` → `IgnoreCase`, `SkipDuplicates` → `IgnoreConflicts`.
10. **Swap** `showWorking: true` for `logLevel` (and `logSlowThresholdMs` for slow-query warnings).
11. **Update** your error handling to the new `VSRepoError` `type` field and the `VSRepoAdapterError` (see [Error handling](./error-handling.md)).
12. **Drop** the `vsrepo generate` step — types now come from your entity/ORM types directly.
13. **Migrate** `patchList` calls to `updateManyWhere`/`updateManyReturningWhere` dynamic methods.

> See the [main README](../README.md) for installation, adapter status, and basic usage.

[⬆️ Back to top](#top)

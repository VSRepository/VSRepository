# Documentation

🇺🇸 English | [🇧🇷 Português](./README.pt-BR.md)

[← Back to the main README](../README.md)

Detailed, example-heavy guides for each VSRepository feature. For the quickstart and adapter status, see the [main README](../README.md). Coming from v1? The complete v1 → v2 reference lives in [Migrating from v1](./migrating-from-v1.md).

| Guide | Covers |
| --- | --- |
| [Adapter status](./adapters.md) | Which ORM adapters exist today and what "ORM-agnostic by design" means in practice. |
| [Base methods, configuration & soft-delete](./base-methods.md) | Constructor options, the 12 automatic CRUD methods, native soft-delete, and the 8 atomic/aggregate methods (`increment`, `sum`, ...). |
| [`select` and `relations`](./select-and-relations.md) | Ad-hoc field selection and eager relation loading on any call, and `InferMethodReturn` to narrow the return type accordingly. |
| [Dynamic methods](./dynamic-methods.md) | `findByEmail`-style methods parsed from a `declare`d method name: prefixes, field filters, logical operators, relation filters, ordering/pagination/distinct. |
| [Query methods (raw SQL)](./query-methods.md) | Raw SQL via `@QueryMethod`, parameterized `VSSql` fragments and the agnostic `?1`/`?2` placeholders (`vsPlaceholders`). |
| [Query builder](./query-builder.md) | The fluent `createQueryBuilder()` API for queries assembled at runtime, including pagination, soft-delete visibility and transactions. |
| [Raw query builder](./raw-query-builder.md) | The fluent `createRawQueryBuilder()` API for hand-written `SELECT` queries too SQL-specific for the query builder — joins, subqueries, CTEs (`with`/`withRecursive`). |
| [Transactions](./transactions.md) | Running several repositories against the same native ORM transaction. |
| [Utility types](./utility-types.md) | The exported helper types (`InferMethodType`, `InferMethodReturn`, `KeysOfType`, ...) and where each one is used. |
| [Writing your own adapter](./writing-an-adapter.md) | What an adapter is responsible for, how to implement the `VSRepoAdapter` contract for a new ORM or database, and how to publish it. |
| [Error handling](./error-handling.md) | `VSRepoError`, `VSRepoErrorType`, and `VSRepoAdapterError`/`AdapterErrorCode`. |
| [Logging](./logging.md) | `logLevel`, `logSlowThresholdMs`, and the log format used by the repository and the query builder. |
| [Migrating from v1](./migrating-from-v1.md) | Everything that changed between v1 and v2 — API, config, renamed suffixes, removed features — and a step-by-step migration walkthrough. |

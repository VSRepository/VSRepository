<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./utility-types.pt-BR.md)

[← Back to the table of contents](./README.md)

# Utility types

Beyond the entity-shaping types covered above (`VSRepoSelect`, `VSRepoRelations`, `VSRepoWhere`), VSRepository exports a set of utility types. They show up throughout the sections above, but here's a consolidated reference. All of them are part of the public API and can be imported directly:

```typescript
import type {
    MethodOptions,
    RestrictMethodOptions,
    InferMethodReturn,
    InferMethodType,
    Pagination,
    Ordering,
    OrderByField,
    SortDirection,
    SeeMode,
    DeepPartial,
    CountResult,
    QueryMethodArg,
    QueryArgs,
    KeysOfType,
    NumericKeys,
    NumericLike,
    DecimalLike,
    Primitive,
    VSRepoWhere,
    VSRepoOrmTypes,
    VSRepoTransactionOptions,
    TransactionIsolationLevel,
} from "vsrepo";
```

| Type                                                | Description                                                                                                                                                                                                                           | Used by                                                                                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MethodOptions<T, K>`                               | Options accepted as the last argument by all dynamic methods and most base methods: `select`, `relations`, `see`, `db`.                                                                                                               | [Base methods](./base-methods.md#base-methods), [Dynamic methods](./dynamic-methods.md#dynamic-methods).                                                                                                               |
| `RestrictMethodOptions<T, K>`                       | Narrowed `MethodOptions<T, K>` exposing only `see`/`db` — used by methods that don't shape/return an `Entity` (`total`, `has`, `sum`, `average`, `min`, `max`, `removeList`, `softRemoveList`, `restoreList`).                        | [Base methods](./base-methods.md#base-methods), [Atomic and aggregate methods](./base-methods.md#atomic-and-aggregate-methods).                                                                                        |
| `InferMethodReturn<T, Options>`                     | Opt-in strict return typing: narrows `T` (`Entity`, `Entity \| null` or `Entity[]`) to the fields and relations actually requested through `select`/`relations`. `select` wins over `relations`.                                      | [Strict return typing with `InferMethodReturn`](./select-and-relations.md#strict-return-typing-with-infermethodreturn).                                                                                                |
| `InferMethodType<Args, Return, OrmTypes?>`          | Declares a dynamic method whose return is inferred on each call from the `select`/`relations` passed as `options`. `OrmTypes` is optional and types the `db` option.                                                                  | [Strict return typing with `InferMethodType`](./dynamic-methods.md#strict-return-typing-with-infermethodtype).                                                                                                         |
| `Pagination`                                        | `{ limit?, offset? }` accepted by `getAll` and by `Paginated` dynamic methods.                                                                                                                                                        | [Base methods](./base-methods.md#base-methods), [Ordering, pagination and distinct](./dynamic-methods.md#ordering-pagination-and-distinct).                                                                            |
| `Ordering<T>` / `OrderByField<T>` / `SortDirection` | Ordering shape accepted by `getAll`, `defaultOrdering`, `injectOrdering` and by `Ordered` dynamic methods. A single object or a chained array.                                                                                        | [Constructor options](./base-methods.md#constructor-options), [Decorator options](./dynamic-methods.md#decorator-options), [Ordering, pagination and distinct](./dynamic-methods.md#ordering-pagination-and-distinct). |
| `SeeMode`                                           | `"active" \| "removed" \| "all"` — controls visibility of soft-deleted records.                                                                                                                                                       | [Soft-delete](./base-methods.md#soft-delete).                                                                                                                                                                          |
| `DeepPartial<T>`                                    | Recursively makes every property of `T` optional, including nested objects and array elements.                                                                                                                                        | `save`, `saveList`, `patch`, `merge`, and all the dynamic writing methods.                                                                                                                                             |
| `CountResult`                                       | `{ count: number }` — the shape returned by batch operations.                                                                                                                                                                         | `removeList`, `softRemoveList`, `restoreList`, `createMany`, `deleteMany`, `updateMany`.                                                                                                                               |
| `QueryMethodArg<T>`                                 | `{ args?: T, db? }` — positional SQL parameters (the placeholder syntax depends on the database/driver behind your adapter: `$1`, `$2`, ... for PostgreSQL, `?` for MySQL) and transaction client for `@QueryMethod`.                 | [Query methods (raw SQL)](./query-methods.md#query-methods-raw-sql).                                                                                                                                                   |
| `QueryArgs<T, O>`                                   | Types the spread parameter list of a `@QueryMethod` declared with `{ spreadArgs: true }`: `T`'s values in order, followed by an optional trailing `DbArg<O>` built via `withDb()`.                                                    | [Spread arguments with `spreadArgs`](./query-methods.md#spread-arguments-with-spreadargs).                                                                                                                             |
| `KeysOfType<T, K>`                                  | Extracts the keys of `T` whose value type is assignable to `K`.                                                                                                                                                                       | Constrains `pkName` in [Constructor options](./base-methods.md#constructor-options) to fields of the entity matching the configured primary-key type.                                                                  |
| `NumericKeys<T>`                                    | Extracts the keys of `T` whose (non-nullable) value type is assignable to `NumericLike`. Nullable numeric fields (`number \| null`) are included.                                                                                     | Constrains `field` in [Atomic and aggregate methods](./base-methods.md#atomic-and-aggregate-methods) (`increment`, `sum`, etc).                                                                                        |
| `NumericLike`                                       | `number \| bigint \| DecimalLike`.                                                                                                                                                                                                    | [Atomic and aggregate methods](./base-methods.md#atomic-and-aggregate-methods).                                                                                                                                        |
| `DecimalLike`                                       | Structural shape of an arbitrary-precision decimal value (`{ toNumber(): number; decimalPlaces(): number }`), matching e.g. Prisma's `Prisma.Decimal` without importing it directly.                                                  | [Which fields are eligible](./base-methods.md#which-fields-are-eligible).                                                                                                                                              |
| `Primitive`                                         | Union of scalar types (`string \| number \| boolean \| bigint \| symbol \| undefined \| null \| Date \| DecimalLike`) treated as leaves — not relations — when walking an entity's shape.                                             | Used by `Ordering<T>` to tell scalar fields apart from relation fields.                                                                                                                                                |
| `VSRepoWhere<T>`                                    | ORM-agnostic filter type accepted by `*Where` dynamic methods (e.g. `findWhere`, `findOneWhere`, `updateWhere`). Supports field filters, logical operators (`AND`/`OR`/`NOT`), and relation filters.                                  | [`findWhere`, `findOneWhere` and other `*Where` prefixes](./dynamic-methods.md#available-prefixes).                                                                                                                    |
| `VSRepoOrmTypes`                                    | `{ dbClient; dbTransaction }` — describes your ORM's client/transaction types. Passed as the third generic to `VSRepository<Entity, PKType, OrmTypes>` to type `getDbClient()`, `transaction()` and the `db` option instead of `any`. | [Creating a repository](../README.md#creating-a-repository).                                                                                                                                                           |
| `VSRepoTransactionOptions`                          | `{ isolationLevel?, timeoutMs? }` — options accepted as the second argument of `transaction()`.                                                                                                                                       | [Transactions](./transactions.md#transactions).                                                                                                                                                                        |
| `TransactionIsolationLevel`                         | Enum of standard SQL isolation levels (`READ_UNCOMMITTED`, `READ_COMMITTED`, `REPEATABLE_READ`, `SERIALIZABLE`) accepted by `VSRepoTransactionOptions.isolationLevel`.                                                                | [Transactions](./transactions.md#transactions).                                                                                                                                                                        |

## `DeepPartial<T>`

Recursively makes all properties optional, walking into nested objects and array elements — unlike TypeScript's built-in `Partial<T>`, which only makes the top level optional:

```typescript
type User = { id: string; name: string; address: { city: string; zip: string } };

const patch: DeepPartial<User> = {
    address: { city: "São Paulo" }, // zip can be omitted; city keeps its type
};

await userRepository.patch(id, patch);
```

## `KeysOfType<T, K>`

Filters an object type down to the keys whose value matches a given type — this is what lets `pkName` accept only fields of the entity that are actually assignable to the repository's primary-key type:

```typescript
type User = { id: string; age: number; name: string };
type StringKeys = KeysOfType<User, string>; // "id" | "name"
```

## `Ordering<T>`

Accepts either a single ordering object or an array of them, applied in the order they're declared:

```typescript
const order: Ordering<User> = { createdAt: "desc" };
const chained: Ordering<User> = [{ name: "asc" }, { createdAt: "desc" }];

await userRepository.getAll({ order: chained });
```

[⬆️ Back to top](#top)

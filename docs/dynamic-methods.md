<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./dynamic-methods.pt-BR.md)

[← Back to the table of contents](./README.md)

# Dynamic methods

Dynamic methods are declared as a `declare` field annotated with `@DynamicMethod()`. Their behavior — which adapter method to call, which filters to apply, and how arguments map to them — is inferred entirely from the field's **name**.

```typescript
class UserRepository extends VSRepository<User, string> {
    @DynamicMethod()
    declare findByEmail: (email: string, options?: MethodOptions<User>) => Promise<User[]>;

    @DynamicMethod()
    declare findOneByEmail: (email: string, options?: MethodOptions<User>) => Promise<User | null>;

    @DynamicMethod()
    declare updateById: (id: string, data: DeepPartial<User>, options?: MethodOptions<User>) => Promise<User>;

    // Where-based: VSRepoWhere<T> as the first param, pagination penultimate, MethodOptions last
    @DynamicMethod()
    declare findWherePaginated: (
        where: VSRepoWhere<User>,
        pagination: Pagination,
        options?: MethodOptions<User>,
    ) => Promise<User[]>;

    // field filters, then pagination, then MethodOptions
    @DynamicMethod()
    declare findByNameIgnoreCaseOrAgeBetweenOrderByCreatedAtAscPaginated: (
        name: string,
        age: [number, number],
        pagination: Pagination,
        options?: MethodOptions<User>,
    ) => Promise<User[]>;
}
```

> **`MethodOptions` is always accepted:** every dynamic method, whatever its prefix, accepts an optional `MethodOptions<Entity, OrmTypes>` (`select`, `relations`, `see`, `db`, ...) as its **last** argument — the resolver treats the argument beyond what the name requires as `MethodOptions`. You still need to **declare it in the TS signature** for TypeScript to let you pass it (as in every example above); the examples further down sometimes omit it for brevity when demonstrating something else, but it's available on all of them too.

## Available prefixes

| Prefix                     | Returns                     | Notes                                                                               |
| -------------------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| `findBy`                   | `Entity[]`                  | Field filters follow the prefix.                                                    |
| `findOneBy`                | `Entity \| null`            | Field filters follow the prefix; single result.                                     |
| `findAndCountBy`           | `PaginatedResult<Entity[]>` | Field filters follow the prefix; resolves to `{ result, count }`.                   |
| `findAndCountWhere`        | `PaginatedResult<Entity[]>` | Receives a `VSRepoWhere<T>` as the first argument; resolves to `{ result, count }`. |
| `findOneOrThrowBy`         | `Entity`                    | Throws if no record is found.                                                       |
| `findOneOrThrowWhere`      | `Entity`                    | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `findWhere`                | `Entity[]`                  | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `findOneWhere`             | `Entity \| null`            | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `countBy`                  | `number`                    | Field filters follow the prefix.                                                    |
| `countWhere`               | `number`                    | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `existsBy`                 | `boolean`                   | Field filters follow the prefix.                                                    |
| `existsWhere`              | `boolean`                   | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `updateBy`                 | `Entity`                    | Field filters + `DeepPartial<Entity>` as argument.                                  |
| `updateWhere`              | `Entity`                    | Receives a `VSRepoWhere<T>` as the first argument, then `DeepPartial<Entity>`.      |
| `updateManyBy`             | `CountResult`               | Field filters + `DeepPartial<Entity>`.                                              |
| `updateManyWhere`          | `CountResult`               | Receives a `VSRepoWhere<T>` as the first argument, then `DeepPartial<Entity>`.      |
| `updateManyReturningBy`    | `Entity[]`                  | Field filters + `DeepPartial<Entity>`.                                              |
| `updateManyReturningWhere` | `Entity[]`                  | Receives a `VSRepoWhere<T>` as the first argument, then `DeepPartial<Entity>`.      |
| `upsertBy`                 | `Entity`                    | Field filters + `create`/`update` payloads.                                         |
| `upsertWhere`              | `Entity`                    | Receives a `VSRepoWhere<T>` as the first argument, then `create`/`update` payloads. |
| `deleteBy`                 | `Entity`                    | Field filters follow the prefix.                                                    |
| `deleteWhere`              | `Entity`                    | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `deleteManyBy`             | `CountResult`               | Field filters follow the prefix.                                                    |
| `deleteManyWhere`          | `CountResult`               | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `deleteManyReturningBy`    | `Entity[]`                  | Field filters follow the prefix.                                                    |
| `deleteManyReturningWhere` | `Entity[]`                  | Receives a `VSRepoWhere<T>` as the first argument.                                  |

> `groupBy` is **not planned** — it doesn't map cleanly onto the ORM-agnostic contract. `aggregate` as a separate prefix is also unlikely to be implemented: the most common aggregate operations (`sum`, `average`, `min`, `max`, `increment`, `decrement`, `multiply`, `divide`) are already available as dedicated base methods — see [Atomic and aggregate methods](./base-methods.md#atomic-and-aggregate-methods). For anything more complex — including `groupBy` — use a `@QueryMethod` with raw SQL or the [raw query builder](./raw-query-builder.md#raw-query-builder) (`createRawQueryBuilder()`), which exposes `groupBy`/`having` directly.

## Field filters

Applied as suffixes to the field name inside the method. Several filters have aliases — use whichever reads best:

| Suffix                               | Meaning                                      | Argument                 |
| ------------------------------------ | -------------------------------------------- | ------------------------ |
| _(none)_ / `Is` / `Equals` / `Equal` | equality (`=`)                               | yes                      |
| `Not` / `NotEquals` / `NotEqual`     | negation                                     | yes                      |
| `In`                                 | is one of                                    | yes (array)              |
| `NotIn`                              | is none of                                   | yes (array)              |
| `Contains` / `Containing`            | substring match                              | yes                      |
| `NotContains` / `NotContaining`      | negated substring match                      | yes                      |
| `StartsWith` / `StartingWith`        | prefix match                                 | yes                      |
| `NotStartsWith` / `NotStartingWith`  | negated prefix match                         | yes                      |
| `EndsWith` / `EndingWith`            | suffix match                                 | yes                      |
| `NotEndsWith` / `NotEndingWith`      | negated suffix match                         | yes                      |
| `Like`                               | SQL `LIKE` pattern (e.g. `"na%"`)            | yes                      |
| `NotLike`                            | negated `LIKE` pattern                       | yes                      |
| `GreaterThan` / `Gt`                 | `>`                                          | yes                      |
| `GreaterThanEqual` / `Gte`           | `>=`                                         | yes                      |
| `LessThan` / `Lt`                    | `<`                                          | yes                      |
| `LessThanEqual` / `Lte`              | `<=`                                         | yes                      |
| `After`                              | `>` — reads naturally on dates               | yes                      |
| `Before`                             | `<` — reads naturally on dates               | yes                      |
| `Between`                            | inclusive range                              | yes (`[min, max]` tuple) |
| `NotBetween`                         | outside an inclusive range                   | yes (`[min, max]` tuple) |
| `Null` / `IsNull`                    | field is `null`                              | no                       |
| `NotNull` / `IsNotNull`              | field is not `null`                          | no                       |
| `True` / `IsTrue`                    | field is `true`                              | no                       |
| `False` / `IsFalse`                  | field is `false`                             | no                       |
| `IgnoreCase` / `IgnoringCase`        | case-insensitive combinator for text filters | yes                      |

Every filter except `IgnoreCase` also accepts an optional `Is` prefix (`IsBetween`, `IsIn`, `IsNotLike`, `IsGreaterThan`, ...), so `findByAgeIsBetween` and `findByAgeBetween` are the same method.

```typescript
@DynamicMethod()
declare findByNameContainsIgnoreCase: (name: string) => Promise<User[]>;

@DynamicMethod()
declare findByAgeBetween: (age: [number, number]) => Promise<User[]>;

@DynamicMethod()
declare findByEmailLike: (pattern: string) => Promise<User[]>; // e.g. "%@gmail.com"

@DynamicMethod()
declare findByCreatedAtAfter: (date: Date) => Promise<User[]>;

@DynamicMethod()
declare findByDeletedAtNull: () => Promise<User[]>;
```

> **Keyword collisions in field names:** a suffix/operator is only recognized at a camelCase boundary — followed by an uppercase letter, a non-ASCII character, or (for field suffixes) the end of the name — so `findByOrganizationId` and `findByNotes` resolve to the fields `organizationId` and `notes`, not to the `Or`/`Not` keywords. This still leaves one case ambiguous: a field whose name genuinely _ends_ at such a boundary with the same letters as a keyword (e.g. `checkIn`, which reads as field `check` + the `In` suffix by default). Append `Equals` (or `Is`) to force equality and disambiguate: `findByCheckInEquals` resolves to the field `checkIn`.

## Logical operators

| Operator | Usage in the name               | Example                                             |
| -------- | ------------------------------- | --------------------------------------------------- |
| `And`    | between two fields              | `findOneByIdAndEmail`                               |
| `Or`     | between two fields              | `findByNameOrEmail`                                 |
| `AND`    | splits a final block into `AND` | `findByEmailOrNameANDActiveStatusAndAgeGreaterThan` |

`AND` (all caps) rules: only one `AND` per method name is allowed; every field connected with `And` after it is nested inside `AND: []`; `Or` cannot appear after an `AND` — using it that way throws a `VSRepoError` (`RESOLVER`) when the repository is constructed. See [Error handling](./error-handling.md#error-handling).

## Relation filters

Filter by fields of related entities. Internally these map to the `_some`/`_every`/`_none`/`_with`/`_without` operators of `VSRepoWhere` (see [`select` and `relations`](./select-and-relations.md#select-and-relations) for the eager-loading counterpart).

| Suffix         | Meaning                                         | Restriction                                                |
| -------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| `Some`         | at least one related record matches             | to-many relations only                                     |
| `SomeField`    | filters within the related records              | to-many relations only                                     |
| `Every`        | every related record matches                    | to-many relations only (needs `Field` to be a real filter) |
| `EveryField`   | filters within the related records              | to-many relations only                                     |
| `None`         | no related record matches                       | to-many relations only                                     |
| `NoneField`    | filters within the related records              | to-many relations only                                     |
| `With`         | related record exists                           | to-one relations only                                      |
| `WithField`    | filters a field within the related record       | to-one relations only                                      |
| `Without`      | related record does not exist                   | to-one relations only                                      |
| `WithoutField` | negated filter on a field of the related record | to-one relations only                                      |

```typescript
@DynamicMethod()
declare findByAddressWithCityStartsWithIgnoreCase: (city: string) => Promise<User[]>;

@DynamicMethod()
declare findByProductsSome: () => Promise<User[]>;
```

These keywords are only recognized **after** the relation name, never at the very start of a field name — so `findByWithDependents` resolves to the field `withDependents`, and `findBySonWithWithDependents` to the `withDependents` field of the `son` relation.

## Ordering and pagination

Available on the `find…` family — `findBy`, `findWhere`, `findAndCountBy`, `findAndCountWhere`, `findOneBy`, `findOneWhere`, `findOneOrThrowBy` and `findOneOrThrowWhere`:

| Suffix                                     | Effect                                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Paginated`                                | Injects a `pagination` argument (`{ limit?, offset? }`) as the **penultimate** parameter (before the optional `MethodOptions`).                                                                                          |
| `Ordered`                                  | Injects an `order: Ordering<T>` argument as the **penultimate** parameter (before the optional `MethodOptions`).                                                                                                         |
| `OrderedAndPaginated`                      | Injects `order` as the antepenultimate, then `pagination` as the penultimate — both before `MethodOptions`.                                                                                                              |
| `PaginatedAndOrdered`                      | Injects `pagination` as the antepenultimate, then `order` as the penultimate — both before `MethodOptions`.                                                                                                              |
| `OrderBy<Field>Asc` / `OrderBy<Field>Desc` | Bakes a fixed ordering directly into the method name — chain fields with `And` (e.g. `OrderByCreatedAtAscAndNameDesc`). No `order` argument needed. _Note: If you do not specify `Asc` or `Desc`, it defaults to `Asc`._ |

> [!WARNING]
>
> **Parameter order:** `pagination` and `order` are always placed **before** the optional `MethodOptions<T>` last argument. When both `order` and `pagination` are present, their relative order follows the suffix name (`OrderedAndPaginated` → order, pagination; `PaginatedAndOrdered` → pagination, order).
>
> Using `Paginated`/`Ordered`/`OrderBy` on a prefix that doesn't support them (e.g. `Paginated` on `existsBy`) throws a `VSRepoError` (`RESOLVER`) when the repository is constructed, rather than silently becoming part of the field name.

```typescript
// Paginated: pagination is the penultimate param (before MethodOptions)
@DynamicMethod()
declare findByActiveOrderByCreatedAtDescPaginated:
    (active: boolean, pagination: Pagination, options?: MethodOptions<User>) => Promise<User[]>;

// OrderedAndPaginated: order, then pagination, then MethodOptions
@DynamicMethod()
declare findByNameContainsIgnoreCaseOrderedAndPaginated:
    (name: string, order: Ordering<User>, pagination: Pagination, options?: MethodOptions<User>) => Promise<User[]>;

```

### `findAndCount…` and the total

`findAndCountBy` and `findAndCountWhere` are the dynamic counterparts of the [`findAndCount`](./base-methods.md#finding-records-and-their-total) base method: they run a `findMany` and a `count` with the same resolved `where` and resolve to a [`PaginatedResult`](./utility-types.md) — `{ result: Entity[]; count: number }`. `order` and `pagination` (through the suffixes above or through `options`) only affect `result`; `count` is the total of records matching the filter.

```typescript
@DynamicMethod()
declare findAndCountByActivePaginated: (
    active: boolean,
    pagination: Pagination,
    options?: MethodOptions<User>,
) => Promise<PaginatedResult<User[]>>;

@DynamicMethod()
declare findAndCountWhere: (where: VSRepoWhere<User>, options?: MethodOptions<User>) => Promise<PaginatedResult<User[]>>;

const { result, count } = await userRepository.findAndCountByActivePaginated(true, { limit: 20, offset: 0 });
```

### `order` and `pagination` through `options`

Without those suffixes, `order` and `pagination` can still be passed in the `options` argument (`MethodOptions` accepts both), so the same method can be reused with different ordering/pagination per call:

```typescript
@DynamicMethod()
declare findByActive: (active: boolean, options?: MethodOptions<User>) => Promise<User[]>;

await userRepository.findByActive(true, { order: { name: "asc" }, pagination: { limit: 20, offset: 40 } });
```

When more than one source defines the ordering, the first one that exists wins:

1. the `order` argument injected by `Ordered`/`OrderedAndPaginated`/`PaginatedAndOrdered`;
2. `options.order`;
3. the `OrderBy…` baked into the method name;
4. the decorator's `injectOrdering`;
5. the repository's `defaultOrdering`.

For pagination, the injected `pagination` argument wins over `options.pagination`.

## Decorator options

`@DynamicMethod<T>(options?)` accepts:

| Option           | Type          | Description                                                                                                                           |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `proxyTo`        | `string`      | Redirects the method's logic to another valid dynamic-method pattern — useful for names that don't follow the naming convention.      |
| `injectOrdering` | `Ordering<T>` | Fixed ordering automatically injected, overriding the repository's `defaultOrdering` (but not an `options.order` passed on the call). |

```typescript
// proxyTo: gives the method a custom name while reusing an existing pattern
@DynamicMethod<User>({ proxyTo: "findByEmail" })
declare buscarPorEmail: (email: string, options?: MethodOptions<User>) => Promise<User[]>;

// injectOrdering: always sorts by createdAt desc, overriding defaultOrdering
@DynamicMethod<User>({ injectOrdering: { createdAt: "desc" } })
declare findByStatus: (status: string) => Promise<User[]>;
```

## Inheriting from another repository

`@DynamicMethod` and `@QueryMethod` work across class inheritance. A subclass inherits every dynamic and query method of its parent, and can declare more of its own:

```typescript
class UserRepository extends VSRepository<User, string> {
    @DynamicMethod()
    declare findByEmail: (email: string) => Promise<User[]>;
}

class AdminRepository extends UserRepository {
    // AdminRepository has `findByEmail` (inherited) and `findByUserType` (its own)
    @DynamicMethod()
    declare findByUserType: (userType: string) => Promise<User[]>;
}
```

> [!NOTE]
> Before **2.7.3**, the methods declared in a subclass were also registered on its parent class and on every sibling class, and redeclaring a method in a subclass changed how the parent resolved it. If you extended decorated repositories, upgrade to get the correct behavior.

## Strict return typing with `InferMethodType`

Normally you write a dynamic method's signature by hand, and its return is whatever you declare (usually the whole entity). `InferMethodType<Args, Return, OrmTypes?>` declares the method for you and infers the return **on each call** from the `select`/`relations` you pass — with the same rules as [`InferMethodReturn`](./select-and-relations.md#strict-return-typing-with-infermethodreturn):

```typescript
class UserRepository extends VSRepository<User, string, MyOrmTypes> {
    @DynamicMethod()
    declare findByName: InferMethodType<[name: string], User[], MyOrmTypes>;

    // the third generic (OrmTypes) is optional
    @DynamicMethod()
    declare findOneByEmail: InferMethodType<[email: string], User | null>;
}

await userRepository.findByName("John");
// { id: string; name: string; email: string }[]  (only the scalar fields)

await userRepository.findByName("John", { select: { id: true, products: { id: true } } });
// { id: string; products: { id: string }[] }[]

await userRepository.findOneByEmail("john@example.com", { relations: { address: true } });
// { id: string; name: string; email: string; address: Address | null } | null
```

| Generic    | Description                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Args`     | Tuple with the method's positional arguments, **without** `options` — e.g. `[name: string]` or `[where: VSRepoWhere<User>, pagination: Pagination]`.                     |
| `Return`   | What the method resolves to: `Entity`, `Entity \| null` or `Entity[]`. The entity type used for `select`/`relations` is taken from here.                                 |
| `OrmTypes` | _Optional._ `VSRepoOrmTypes` for your ORM, used to type the `db` option (see [Creating a repository](../README.md#creating-a-repository)). Defaults to `VSRepoOrmTypes`. |

- `options` (`MethodOptions<Entity, OrmTypes>`) is always the **last**, optional parameter, after every argument in `Args`. If one of those arguments is optional, pass `undefined` explicitly to reach `options`.
- Without `options` the result has only the scalar fields; with them it follows the [same rules](./select-and-relations.md#strict-return-typing-with-infermethodreturn) as `InferMethodReturn` (including `select` winning over `relations`).
- It works together with the [decorator options](#decorator-options) (`proxyTo`, `injectOrdering`).
- It is meant for dynamic methods that return entities (`findBy…`, `findOneBy…`, `findWhere…`, …). Methods that don't — `countBy…`, `existsBy…` — keep their regular signature.

## Lazily resolving dynamic methods

By default, the `VSRepository` constructor synchronously resolves every `@DynamicMethod`/`@QueryMethod` on the subclass. Passing `lazyDynamicMethods: true` in the constructor options postpones that resolution — the repository is ready to use (base methods like `get`, `save`, etc.), but dynamic methods only exist once the subclass itself calls the `protected resolveDynamicMethods()` method inherited from `VSRepository`:

```typescript
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ pkName: "id", adapter, lazyDynamicMethods: true });
        this.resolveDynamicMethods();
    }

    @DynamicMethod()
    declare findByEmail: (email: string) => Promise<User[]>;
}
```

Deferring the call further — to a later lifecycle hook — is just as valid, and is where the option is actually useful: it lets you push the resolution cost (relevant for repositories with many decorated methods) to a more convenient point in the application's lifecycle, e.g. an async initialization hook:

```typescript
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ pkName: "id", adapter, lazyDynamicMethods: true });
    }

    @DynamicMethod()
    declare findByEmail: (email: string) => Promise<User[]>;

    // e.g. called from NestJS's onModuleInit
    init() {
        this.resolveDynamicMethods();
    }
}
```

### `declare` becomes optional

Normally, a field annotated with `@DynamicMethod()`/`@QueryMethod()` needs the `declare` modifier:

```typescript
@DynamicMethod()
declare findByEmail: (email: string) => Promise<User[]>;
```

This exists because of TypeScript's `useDefineForClassFields`: without `declare`, the compiler emits a `this.findByEmail = undefined` as part of the subclass's field initialization, which runs right after `super()` returns — i.e. **after** the `VSRepository` constructor has already assigned the function to the method. Without `declare`, that `undefined` would overwrite the freshly assigned function.

With `lazyDynamicMethods: true`, that field initialization already ran by the time `resolveDynamicMethods()` executes — whether it's called right on the next line after `super(...)` or from a later hook like `onModuleInit` — so there's nothing left to overwrite the assigned function, and `declare` becomes optional:

```typescript
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ pkName: "id", adapter, lazyDynamicMethods: true });
        this.resolveDynamicMethods();
    }

    // no "declare" needed
    @DynamicMethod()
    findByEmail: (email: string) => Promise<User[]>;
}
```

> [!NOTE]
>
> Calling `resolveDynamicMethods()` again after dynamic methods have already been resolved (whether you called it manually more than once, or by mistake on top of an eager resolution) doesn't throw — it just re-runs the resolution, overwriting the methods with equivalent closures. Since this is normally redundant and signals a mistake, the repository logs a `WARN` on the internal logger in that case.

[⬆️ Back to top](#top)

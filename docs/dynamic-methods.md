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

> **`MethodOptions` is always accepted:** every dynamic method, whatever its prefix, accepts an optional `MethodOptions<Entity, OrmTypes>` (`select`, `relations`, `see`, `db`, ...) as its **last** argument — the resolver treats the argument beyond what the name requires as `MethodOptions` and validates it as such. You still need to **declare it in the TS signature** for TypeScript to let you pass it (as in every example above); the examples further down sometimes omit it for brevity when demonstrating something else, but it's available on all of them too.

## Available prefixes

| Prefix                     | Returns          | Notes                                                                               |
| -------------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `findBy`                   | `Entity[]`       | Field filters follow the prefix.                                                    |
| `findOneBy`                | `Entity \| null` | Field filters follow the prefix; single result.                                     |
| `findOneOrThrowBy`         | `Entity`         | Throws if no record is found.                                                       |
| `findOneOrThrow`           | `Entity`         | No field filters; applies only soft-delete/`see`.                                   |
| `findOneOrThrowWhere`      | `Entity`         | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `findWhere`                | `Entity[]`       | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `findOneWhere`             | `Entity \| null` | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `findOne`                  | `Entity \| null` | No field filters; applies only soft-delete/`see`.                                   |
| `countBy`                  | `number`         | Field filters follow the prefix.                                                    |
| `countWhere`               | `number`         | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `count`                    | `number`         | No field filters.                                                                   |
| `existsBy`                 | `boolean`        | Field filters follow the prefix.                                                    |
| `existsWhere`              | `boolean`        | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `create`                   | `Entity`         | Receives `DeepPartial<Entity>` as argument.                                         |
| `createMany`               | `CountResult`    | Receives `DeepPartial<Entity>[]` as argument; supports `IgnoreConflicts`.           |
| `createManyReturning`      | `Entity[]`       | Receives `DeepPartial<Entity>[]` as argument; supports `IgnoreConflicts`.           |
| `updateBy`                 | `Entity`         | Field filters + `DeepPartial<Entity>` as argument.                                  |
| `updateWhere`              | `Entity`         | Receives a `VSRepoWhere<T>` as the first argument, then `DeepPartial<Entity>`.      |
| `updateManyBy`             | `CountResult`    | Field filters + `DeepPartial<Entity>`.                                              |
| `updateManyWhere`          | `CountResult`    | Receives a `VSRepoWhere<T>` as the first argument, then `DeepPartial<Entity>`.      |
| `updateManyReturningBy`    | `Entity[]`       | Field filters + `DeepPartial<Entity>`.                                              |
| `updateManyReturningWhere` | `Entity[]`       | Receives a `VSRepoWhere<T>` as the first argument, then `DeepPartial<Entity>`.      |
| `upsertBy`                 | `Entity`         | Field filters + `create`/`update` payloads.                                         |
| `upsertWhere`              | `Entity`         | Receives a `VSRepoWhere<T>` as the first argument, then `create`/`update` payloads. |
| `deleteBy`                 | `Entity`         | Field filters follow the prefix.                                                    |
| `deleteWhere`              | `Entity`         | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `deleteManyBy`             | `CountResult`    | Field filters follow the prefix.                                                    |
| `deleteManyWhere`          | `CountResult`    | Receives a `VSRepoWhere<T>` as the first argument.                                  |
| `deleteManyReturningBy`    | `Entity[]`       | Field filters follow the prefix.                                                    |
| `deleteManyReturningWhere` | `Entity[]`       | Receives a `VSRepoWhere<T>` as the first argument.                                  |

> `groupBy` is **not planned** — it doesn't map cleanly onto the ORM-agnostic contract. `aggregate` as a separate prefix is also unlikely to be implemented: the most common aggregate operations (`sum`, `average`, `min`, `max`, `increment`, `decrement`, `multiply`, `divide`) are already available as dedicated base methods — see [Atomic and aggregate methods](./base-methods.md#atomic-and-aggregate-methods). For anything more complex, use a `@QueryMethod` with raw SQL.

## Field filters

Applied as suffixes to the field name inside the method:

| Suffix              | Meaning                                                          | Argument                             |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| _(none)_ / `Equals` | equality (`=`)                                                   | yes                                  |
| `Not` / `NotEquals` | negation                                                         | yes                                  |
| `In`                | is one of                                                        | yes (array)                          |
| `NotIn`             | is none of                                                       | yes (array)                          |
| `Contains`          | substring match                                                  | yes                                  |
| `NotContains`       | negated substring match                                          | yes                                  |
| `StartsWith`        | prefix match                                                     | yes                                  |
| `NotStartsWith`     | negated prefix match                                             | yes                                  |
| `EndsWith`          | suffix match                                                     | yes                                  |
| `NotEndsWith`       | negated suffix match                                             | yes                                  |
| `GreaterThan`       | `>`                                                              | yes                                  |
| `GreaterThanEqual`  | `>=`                                                             | yes                                  |
| `LessThan`          | `<`                                                              | yes                                  |
| `LessThanEqual`     | `<=`                                                             | yes                                  |
| `Between`           | inclusive range                                                  | yes (`[min, max]` tuple)             |
| `NotBetween`        | outside an inclusive range                                       | yes (`[min, max]` tuple)             |
| `IsNull`            | field is `null`                                                  | no                                   |
| `IsNotNull`         | field is not `null`                                              | no                                   |
| `IsTrue`            | field is `true`                                                  | no                                   |
| `IsFalse`           | field is `false`                                                 | no                                   |
| `IgnoreCase`        | case-insensitive combinator for text filters                     | yes                                  |
| `Optional`          | optional flag to make it explicit that the parameter is optional | yes _(in practice, nothing changes)_ |

```typescript
@DynamicMethod()
declare findByNameContainsIgnoreCase: (name: string) => Promise<User[]>;

@DynamicMethod()
declare findByAgeBetween: (age: [number, number]) => Promise<User[]>;
```

> **Keyword collisions in field names:** a suffix/operator is only recognized at a camelCase boundary — followed by an uppercase letter, a non-ASCII character, or (for field suffixes) the end of the name — so `findByOrganizationId` and `findByNotes` resolve to the fields `organizationId` and `notes`, not to the `Or`/`Not` keywords. This still leaves one case ambiguous: a field whose name genuinely _ends_ at such a boundary with the same letters as a keyword (e.g. `checkIn`, which reads as field `check` + the `In` suffix by default). Append `Equals` (or `NotEquals`) to force equality and disambiguate: `findByCheckInEquals` resolves to the field `checkIn`.

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

## Ordering, pagination and distinct

| Suffix                                     | Effect                                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Paginated`                                | Injects a `pagination` argument (`{ limit?, offset? }`) as the **penultimate** parameter (before the optional `MethodOptions`).                                                                                          |
| `Ordered`                                  | Injects an `order: Ordering<T>` argument as the **penultimate** parameter (before the optional `MethodOptions`).                                                                                                         |
| `OrderedAndPaginated`                      | Injects `order` as the antepenultimate, then `pagination` as the penultimate — both before `MethodOptions`.                                                                                                              |
| `PaginatedAndOrdered`                      | Injects `pagination` as the antepenultimate, then `order` as the penultimate — both before `MethodOptions`.                                                                                                              |
| `OrderBy<Field>Asc` / `OrderBy<Field>Desc` | Bakes a fixed ordering directly into the method name — chain fields with `And` (e.g. `OrderByCreatedAtAscAndNameDesc`). No `order` argument needed. _Note: If you do not specify `Asc` or `Desc`, it defaults to `Asc`._ |
| `Distinct<Field>And<Field>...`             | Bakes fixed `distinct` fields directly into the method name (only valid on `findBy`/`findWhere`-family methods).                                                                                                         |
| `IgnoreConflicts`                          | On `createMany`/`createManyReturning`, skips records that would violate a unique constraint instead of throwing.                                                                                                         |

> ⚠️ **Parameter order:** `pagination` and `order` are always placed **before** the optional `MethodOptions<T>` last argument. When both `order` and `pagination` are present, their relative order follows the suffix name (`OrderedAndPaginated` → order, pagination; `PaginatedAndOrdered` → pagination, order).
>
> Using `Paginated`/`Ordered`/`OrderBy`, `Distinct` or `IgnoreConflicts` on a prefix that doesn't support them (e.g. `Distinct` on `findOneBy`, `Paginated` on `existsBy`, `IgnoreConflicts` on `create`) throws a `VSRepoError` (`RESOLVER`) when the repository is constructed, rather than silently becoming part of the field name.

```typescript
// Paginated: pagination is the penultimate param (before MethodOptions)
@DynamicMethod()
declare findByActiveOrderByCreatedAtDescPaginated:
    (active: boolean, pagination: Pagination, options?: MethodOptions<User>) => Promise<User[]>;

// OrderedAndPaginated: order, then pagination, then MethodOptions
@DynamicMethod()
declare findByNameContainsIgnoreCaseOrderedAndPaginated:
    (name: string, order: Ordering<User>, pagination: Pagination, options?: MethodOptions<User>) => Promise<User[]>;

@DynamicMethod()
declare createManyIgnoreConflicts: (data: DeepPartial<User>[]) => Promise<CountResult>;

// createManyReturning: same as createMany, but returns the created records
@DynamicMethod()
declare createManyReturningIgnoreConflicts: (data: DeepPartial<User>[]) => Promise<User[]>;

// findOne with no filter (equivalent to findOneOrThrow with no filter, but returns null instead of throwing)
@DynamicMethod()
declare findOne: (options?: MethodOptions<User>) => Promise<User | null>;
```

> ⚠️ **Precedence between `Distinct` and `OrderBy`:** when both are used in the same method name, **`Distinct` must come before `OrderBy`**:
>
> ```typescript
> @DynamicMethod()
> declare findByActiveDistinctNameOrderByCreatedAtDesc:
>     (active: boolean) => Promise<User[]>;
> ```
>
> Putting `OrderBy` before `Distinct` (e.g. `findByActiveOrderByCreatedAtDescDistinctName`) is not a valid pattern and throws a `VSRepoError` (`RESOLVER`) when the repository is constructed: `The "Distinct" modifier cannot appear after the "OrderBy" modifier.`

## Decorator options

`@DynamicMethod<T>(options?)` accepts:

| Option           | Type          | Description                                                                                                                      |
| ---------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `proxyTo`        | `string`      | Redirects the method's logic to another valid dynamic-method pattern — useful for names that don't follow the naming convention. |
| `injectOrdering` | `Ordering<T>` | Fixed ordering automatically injected, overriding the repository's `defaultOrdering`.                                            |

```typescript
// proxyTo: gives the method a custom name while reusing an existing pattern
@DynamicMethod<User>({ proxyTo: "findByEmail" })
declare buscarPorEmail: (email: string, options?: MethodOptions<User>) => Promise<User[]>;

// injectOrdering: always sorts by createdAt desc, overriding defaultOrdering
@DynamicMethod<User>({ injectOrdering: { createdAt: "desc" } })
declare findByStatus: (status: string) => Promise<User[]>;
```

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

    // e.g. called from Nest's onModuleInit
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
> Calling `resolveDynamicMethods()` again after dynamic methods have already been resolved (whether you called it manually more than once, or by mistake on top of an eager resolution) doesn't throw — it just re-runs the resolution, overwriting the methods with equivalent closures. Since this is normally redundant and signals a mistake, the repository logs a `WARN` on the internal logger in that case.

[⬆️ Back to top](#top)

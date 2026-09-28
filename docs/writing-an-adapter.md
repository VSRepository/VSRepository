<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./writing-an-adapter.pt-BR.md)

[← Back to the table of contents](./README.md)

# Writing your own adapter

Because the core is ORM-agnostic and ships without a bundled adapter, adding support for an ORM/database — whether that's a stopgap for your own project or a candidate for a future `@vsrepo/*-adapter` package — means implementing the `VSRepoAdapter<T>` abstract class.

## What you're implementing

Before the contract itself, it's worth being clear about **what an adapter actually does**, because the answer is narrower than it first looks.

`VSRepository` owns all of the abstraction. Given a call like `userRepository.get("user-1", { relations: { address: true } })`, the repository:

- resolves the primary key into a `VSRepoWhere<T>` (`{ id: "user-1" }`),
- merges in the soft-delete filter implied by `softRemoveKey`/`see`,
- validates the options,
- logs the operation and times it,
- and then calls **exactly one** method on your adapter, with the resolved `where` and options.

Everything above is ORM-agnostic and shared by every adapter. What remains for you is the last step: turning a `VSRepoWhere<T>` plus an `AdapterMethodOptions<T>` into a real read or write against your database, and turning the result back into a `T`. Your adapter is the **only** code in the stack that knows your ORM exists.

The types you'll meet throughout the contract are all documented in [Utility types](./utility-types.md):

| Type                      | Role in the contract                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `VSRepoWhere<T>`          | The already-resolved filter. It must be converted to the ORM equivalent for your adapter.                  |
| `AdapterMethodOptions<T>` | The per-call options: `select`, `relations`, `see`, and the transaction handle.                            |
| `DeepPartial<T>`          | A partial entity for writes — a nested `DeepPartial` of a relation is a nested partial, not a full object. |
| `CountResult`             | What `createMany`/`deleteMany`/`updateMany` resolve to when the caller only wants `{ count }`.             |
| `NumericKeys<T>`          | Constrains the atomic/aggregate `field` argument to numeric (or `DecimalLike`) columns.                    |

## The `VSRepoAdapter` contract

```typescript
export abstract class VSRepoAdapter<T> {
    abstract runInTransaction<R>(fn: (tx: any) => Promise<R>, options?: VSRepoTransactionOptions): Promise<R>;
    abstract getDbClient(): any;
    abstract query<T = any>(query: string, options?: AdapterQueryOptions): Promise<T>;
    abstract findOne(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<T | null>;
    abstract findOneOrThrow(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<T>;
    abstract findMany(
        where: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T> & { distinct?: (keyof T)[] },
    ): Promise<T[]>;
    abstract save(obj: DeepPartial<T>, options?: AdapterMethodOptions<T>): Promise<T>;
    abstract saveMany(objs: DeepPartial<T>[], options?: AdapterMethodOptions<T>): Promise<T[]>;
    abstract create(objs: DeepPartial<T>, options?: AdapterMethodOptions<T>): Promise<T>;
    abstract createMany(
        objs: DeepPartial<T>[],
        options?: AdapterMethodOptions<T> & { ignoreConflicts?: boolean },
    ): Promise<CountResult>;
    abstract createManyReturning(
        objs: DeepPartial<T>[],
        options?: AdapterMethodOptions<T> & { ignoreConflicts?: boolean },
    ): Promise<T[]>;
    abstract delete(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<T>;
    abstract deleteMany(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<CountResult>;
    abstract deleteManyReturning(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<T[]>;
    abstract update(where: VSRepoWhere<T>, obj: DeepPartial<T>, options?: AdapterMethodOptions<T>): Promise<T>;
    abstract updateMany(
        where: VSRepoWhere<T>,
        obj: DeepPartial<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<CountResult>;
    abstract updateManyReturning(
        where: VSRepoWhere<T>,
        obj: DeepPartial<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<T[]>;
    abstract count(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<number>;
    abstract exists(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<boolean>;
    abstract merge<K>(where: VSRepoWhere<T>, obj: DeepPartial<T>, options?: AdapterMethodOptions<T>): Promise<K & T>;
    abstract upsert(
        where: VSRepoWhere<T>,
        create: DeepPartial<T>,
        update: DeepPartial<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<T>;
    abstract incrementOne<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<T>;
    abstract decrementOne<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<T>;
    abstract multiplyOne<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<T>;
    abstract divideOne<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<T>;
    abstract sum(
        field: NumericKeys<T>,
        where?: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<number | null>;
    abstract average(
        field: NumericKeys<T>,
        where?: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<number | null>;
    abstract min(
        field: NumericKeys<T>,
        where?: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<number | null>;
    abstract max(
        field: NumericKeys<T>,
        where?: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<number | null>;
    getPkName?(): string;
    getPlaceholder?(index: number): string;
}
```

The optional `getPkName()` lets the adapter declare the entity's primary-key field to the repository. When instantiating a `VSRepository`, you can omit `pkName` from the constructor options and it will be read from `adapter.getPkName()`. If you omit it and the adapter doesn't implement `getPkName()`, the constructor throws a `VSRepoError`.

The optional `getPlaceholder?(index)` declares the placeholder syntax your database/driver expects for the Nth (0-based) bound parameter in a raw query — e.g. PostgreSQL returns `` `$${index + 1}` `` (`$1`, `$2`, ...), while SQLite/MySQL ignore `index` and always return `"?"`. Implementing it is what unlocks the parameterized query features: `query()` can then accept a `VSSql` fragment, and `vsPlaceholders: true` compiles VSRepository's own `?1`, `?2`, ... placeholders — both through `getPlaceholder()`. Without it, passing a `VSSql` fragment, or enabling `vsPlaceholders`, throws a `VSRepoError`. See [Query methods](./query-methods.md#parameterized-fragments-with-vssql).

`VSRepository` never talks to the ORM directly — it only calls these methods with an already-resolved `VSRepoWhere<T>` and `AdapterMethodOptions<T>`. Once an adapter implements this contract, every base method, dynamic method, and query method works against it automatically.

Two rules cover the method bodies:

- **Don't rebuild the filter — but do translate it.** The `where` is already resolved, validated and already carries the soft-delete filter. Translating its _shape_ into your ORM's vocabulary is your job, and is the subject of the next section.
- **Wrap every ORM error — never let it escape raw.** Anything the ORM/driver throws must be caught and rethrown as a `VSRepoAdapterError`, with the raw error kept in `originalError` and the failure classified by an `AdapterErrorCode` (see [`VSRepoAdapterError` and `AdapterErrorCode`](./error-handling.md#vsrepoadaptererror-and-adaptererrorcode)). Swallowing it, or letting the ORM's own error class reach the caller, breaks the guarantee that callers never depend on a single ORM's error shape:

    ```typescript
    import { VSRepoAdapterError, AdapterErrorCode } from "vsrepo";

    try {
        return await this.orm.user.create({ data: obj });
    } catch (err) {
        throw new VSRepoAdapterError(
            "adapter create failed",
            mapOrmError(err), // the ORM's own error → a stable AdapterErrorCode
            err, // the original error, preserved in `originalError`
        );
    }
    ```

For a full, working implementation, see the external [`VSRepoPrisma7Adapter`](https://github.com/jaobrabo123/VSRepoPrisma7Adapter) repo.

## Translating the generic arguments into your ORM

`VSRepoWhere<T>`, for example, is a **generic, ORM-agnostic filter** — it is not the query syntax of any particular ORM. The repository resolves it for you; turning it into something your ORM understands is adapter's job.

Take `{ name: { equals: "Ana", contains: "an", ignoreCase: true }, age: { between: [18, 65] } }`:

```typescript
// Prisma 7 — `equals` survives, `between` expands, `ignoreCase` becomes a mode
{ name: { equals: "Ana", contains: "an", mode: "insensitive" }, age: { gte: 18, lte: 65 } }

// Drizzle — `equals` becomes `eq`, the string filter becomes a wildcarded `ilike`
{ name: { eq: "Ana", ilike: "%an%" }, age: { gte: 18, lte: 65 } }
```

Same input, two different outputs, and neither is a pass-through: `between: [min, max]` has to become `gte: min, lte: max` in both, and `equals` only keeps its name in Prisma. Operators that already match your ORM's keys (`gt`, `gte`, `lt`, `lte`, `in`, `notIn`) _can_ be forwarded untouched — the ones that don't, must be rewritten.

## Logging from your adapter

`vsrepo` exports the same `VSLogger` class the core uses internally, so your adapter can log in the same format/style (timestamps, colored level labels, slow-operation warnings) instead of rolling its own:

```typescript
import { VSLogger, VSLogLevel, VSRepoAdapterError, AdapterErrorCode } from "vsrepo";

export class MyOrmAdapter<T> extends VSRepoAdapter<T> {
    private readonly logger = new VSLogger(VSLogLevel.WARN, "MyOrmAdapterLogger");

    async findOne(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>) {
        const start = this.logger.startPerformLog("adapter findOne");
        try {
            // ... talk to the ORM ...
            this.logger.endPerformLog(start);
            return result;
        } catch (err) {
            this.logger.endPerformLog(start);
            this.logger.logError("adapter findOne failed", err);
            throw new VSRepoAdapterError("adapter findOne failed", AdapterErrorCode.UNKNOWN, err);
        }
    }
}
```

The logger only observes the failure; the `VSRepoAdapterError` is what the caller actually receives, which is the wrapping the rule above requires.

| Method                                               | Description                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new VSLogger(logLevel, name, slowThresholdMs?)`     | Creates a logger; `name` prefixes every line. `slowThresholdMs` controls the slow-operation threshold: a `number` sets it in ms (default 300), `false` disables slow-operation warnings entirely, `true` or omitted uses the 300ms default. |
| `logDebug/logInfo/logWarn(text, obj?)`               | Logs at the given level if `logLevel` allows it; `obj` is appended as pretty-printed JSON.                                                                                                                                                  |
| `logError(text, err?)`                               | Logs at `ERROR`; if `err` is an `Error`, only `name`/`message`/`stack`/`cause` are logged.                                                                                                                                                  |
| `startPerformLog(operation)` / `endPerformLog(data)` | Bracket a block to log its duration, escalating to `WARN` if it exceeds `slowThresholdMs`.                                                                                                                                                  |
| `getLogLevel()`                                      | Returns the logger's configured `VSLogLevel`.                                                                                                                                                                                               |

This is purely a convenience for adapter authors — nothing in the core requires your adapter to use it.

## Publishing an adapter

An adapter doesn't live in this repository, and it doesn't have to be official to be useful. There are two paths, and they're genuinely different: **publishing your own** is entirely under your control, while **becoming an official `@vsrepo/*-adapter`** is a gated process with a validation bar.

### Publishing your own adapter

Publishing your own adapter is entirely under your control: pick the name and the scope, host it wherever you want, and release it on your own schedule.

That path never closes. If the adapter later proves itself, you can ask for it to be reviewed and promoted to an official `@vsrepo/*-adapter` — which is exactly what the next subsection covers.

### Becoming an official adapter

An official adapter is published under the `@vsrepo` scope on npm, which the project controls. Publishing to that scope goes through npm's staged publishing, so your repository needs a workflow that can publish it:

- a `npm-publish` environment, which is where access is granted and reviewed;
- `npm stage publish --tag <dist-tag>`, which stages the release instead of publishing straight to `latest`; the workflow derives the dist-tag from the git tag (`v1.2.0` → `latest`, `v1.2.0-beta.1` → `beta`).

That's the same pipeline the core itself uses — see [`.github/workflows/publish.yml`](https://github.com/jaobrabo123/VSRepository/blob/main/.github/workflows/publish.yml). Access is granted once the checklist below passes.

| Requirement            | What it means                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full contract          | Every abstract method of `VSRepoAdapter`, including the 8 atomic/aggregate operations (`incrementOne`, `decrementOne`, `multiplyOne`, `divideOne`, `sum`, `average`, `min`, `max`). |
| Contract tests         | A fake client plus a suite asserting _which_ adapter methods the repository calls and _with which arguments_.                                                                       |
| Integration tests      | **Tests against a real database**, exercising the SQL your adapter actually generates.                                                                                              |
| `getPlaceholder()`     | Implemented, otherwise `query()`, `VSSql` fragments and `vsPlaceholders` don't work.                                                                                                |
| Peer dependencies      | The ORM and the core `vsrepo` declared as `peerDependencies`.                                                                                                                       |
| Independent repo       | Its own repository, versioned and released independently of the core.                                                                                                               |
| Maturity dist-tag      | `latest` once the adapter is production-ready; `alpha`/`beta` while it isn't. Never publish a work-in-progress as `latest`.                                                         |
| Registration           | A PR adding a row to the official table in [Adapter status](./adapters.md#adapter-status).                                                                                          |

To request it, open an issue with the link to your repository and a short note on which ORM versions you support.

[⬆️ Back to top](#top)

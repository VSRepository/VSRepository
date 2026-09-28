<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./query-methods.pt-BR.md)

[← Back to the table of contents](./README.md)

# Query methods (raw SQL)

`@QueryMethod` bypasses the name-parsing engine entirely and executes a raw SQL statement through the adapter's `query()` method. Use placeholders for the values passed via `args` — never interpolate values directly into the SQL string.

There are three ways to write values in a raw query:

- **Your adapter's native placeholder syntax** — the `$1`, `$2`, ... style used in the examples below is the PostgreSQL convention; MySQL, for instance, uses `?`. Check your adapter's documentation for the exact syntax.
- **VSRepository's own agnostic placeholders** — with `vsPlaceholders: true` in the constructor options, plain strings use `?1`, `?2`, ... (1-based, Spring Data JPA style) regardless of the database behind the adapter. See [Agnostic placeholders with `vsPlaceholders`](#agnostic-placeholders-with-vsplaceholders).
- **`VSSql` fragments** — build the query as a composable fragment with the `VSSql.sql` tagged template and pass it straight to `query()`; values are parameterized automatically. See [Parameterized fragments with `VSSql`](#parameterized-fragments-with-vssql).

```typescript
class UserRepository extends VSRepository<User, string> {
    @QueryMethod('SELECT * FROM "user" WHERE email = $1')
    declare findByEmailRaw: (arg: QueryMethodArg<[email: string]>) => Promise<User[]>;

    @QueryMethod('UPDATE "user" SET active = true WHERE id = $1', { modifying: true })
    declare activateUser: (arg: QueryMethodArg<[id: string]>) => Promise<number>;

    // Only one row is ever expected here, so `singleResult` collapses the
    // array into a single object (or `null` when no row matches).
    @QueryMethod('SELECT * FROM "user" WHERE id = $1 LIMIT 1', { singleResult: true })
    declare findByIdRaw: (arg: QueryMethodArg<[id: string]>) => Promise<User | null>;
}
```

| Option         | Type      | Default | Description                                                                                                                                                                                                                                     |
| -------------- | --------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modifying`    | `boolean` | `false` | When `true`, the method resolves to the number of affected rows. When `false`, runs as a read query and resolves to the declared return type.                                                                                                   |
| `singleResult` | `boolean` | `false` | When `true`, collapses an array result into its first element (`null` if empty), so you can declare the return type as a single object instead of an array. Has no effect on non-array results (e.g. a `modifying` query's affected-row count). |

Query methods accept `{ args, db? }` at the call site — `db` lets them participate in a `transaction()` block just like base and dynamic methods.

## Spread arguments with `spreadArgs`

By default, a `@QueryMethod` receives its placeholder values through a single `QueryMethodArg` object (`method({ args: [...] })`). Set `spreadArgs: true` to receive them as separate positional arguments instead:

```typescript
class UserRepository extends VSRepository<User, string> {
    @QueryMethod('SELECT * FROM "user" WHERE email = $1 AND "userType" = $2', {
        spreadArgs: true,
    })
    declare findByEmailAndType: (...args: QueryArgs<[email: string, userType: string]>) => Promise<User[]>;

    // Instead of using `QueryArgs`, you can also simply set `DbArg` as the last parameter
    @QueryMethod('SELECT * FROM "user" WHERE id = $1', { spreadArgs: true })
    declare findById: (id: string, db?: DbArg) => Promise<User[]>;
}

const admins = await userRepository.findByEmailAndType("joao@email.com", "admin");
```

To run the query against a specific client or transaction instead of the repository's default one, pass `withDb(tx)` as the trailing argument — it wraps `tx` in a `DbArg`, which the resolver recognizes with `instanceof`, so it's never confused with a regular positional argument even if that argument happens to be an object:

```typescript
await userRepository.transaction(async tx => {
    await userRepository.findByEmailAndType("joao@email.com", "admin", withDb(tx));
});
```

`spreadArgs` only affects `@QueryMethod`-declared fields — it's `false` by default, and calling a method declared without it using more than one argument throws, since the single-`QueryMethodArg` call style is expected instead. It has no effect on `query()`, which always accepts `{ args, db? }`.

## Ad-hoc raw queries with `query()`

For one-off raw SQL that doesn't warrant declaring a `@QueryMethod` on the repository class, call `query()` directly — it's available on every `VSRepository` instance and uses the adapter's `query()` under the hood:

```typescript
const users = await userRepository.query<User[]>('SELECT * FROM "user" WHERE email = $1', {
    args: ["maria@email.com"],
});

const affectedRows = await userRepository.query<number>('UPDATE "user" SET active = true WHERE id = $1', {
    args: ["123"],
    modifying: true,
});

// Only one row is ever expected here, so `singleResult` collapses the
// array into a single object (or `null` when no row matches).
const user = await userRepository.query<User | null>('SELECT * FROM "user" WHERE id = $1 LIMIT 1', {
    args: ["123"],
    singleResult: true,
});
```

The second overload accepts a `VSSql` fragment (see [Parameterized fragments with `VSSql`](#parameterized-fragments-with-vssql)) — let the fragment bring its own parameterized values instead of passing `args`:

```typescript
const users = await userRepository.query<User[]>(
    VSSql.sql`SELECT * FROM "user" WHERE email = ${"maria@email.com"} AND active = ${true}`,
);

const affectedRows = await userRepository.query<number>(
    VSSql.sql`UPDATE "user" SET active = true WHERE id = ${"123"}`,
    { modifying: true },
);
```

| Option         | Type      | Default                     | Description                                                                                                                                                                                                                                                                                                                                   |
| -------------- | --------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `args`         | `any[]`   | `undefined`                 | Positional parameters injected into the SQL placeholders — the placeholder syntax depends on the database/driver behind your adapter (or use `vsPlaceholders` for `?1` placeholders, see below). Never interpolate values directly into the SQL string. Not accepted when `sql` is a `VSSql` fragment — its values are already parameterized. |
| `db`           | `any`     | Repository's default client | Database client or transaction to run this query in.                                                                                                                                                                                                                                                                                          |
| `modifying`    | `boolean` | `false`                     | When `true`, returns the number of affected rows.                                                                                                                                                                                                                                                                                             |
| `singleResult` | `boolean` | `false`                     | When `true`, collapses an array result into its first element (`null` if empty). Has no effect on non-array results (e.g. a `modifying` query's affected-row count).                                                                                                                                                                          |

Just like base, dynamic and query methods, `query()` accepts `db` in `options` to participate in a `transaction()` block.

## Agnostic placeholders with `vsPlaceholders`

To avoid depending on the placeholder dialect of your adapter/database, set `vsPlaceholders: true` in the [constructor options](./base-methods.md#constructor-options) and raw SQL strings passed to `query()` and `@QueryMethod` stop using your database's native syntax — they use VSRepository's own agnostic, positional placeholders instead: `?1`, `?2`, ... (1-based, Spring Data JPA style).

```typescript
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ adapter, pkName: "id", vsPlaceholders: true });
    }

    @QueryMethod('SELECT * FROM "user" WHERE email = ?1 AND active = ?2', { spreadArgs: true })
    declare findByEmailAndActive: (email: string, active: boolean) => Promise<User[]>;
}

const users = await userRepository.query<User[]>('SELECT * FROM "user" WHERE email = ?1', {
    args: ["maria@email.com"],
});
```

> [!NOTE]
>
> - The same index may appear more than once (`?1 ... ?1`) to reuse the same argument — each occurrence becomes its own placeholder/value pair in the compiled output.
> - A `?N` inside a single-quoted string literal (e.g. `SELECT ... WHERE note = 'use ?1 literally'`) is **not** treated as a placeholder — it is passed through to the SQL untouched and consumes no `args` entry. Standard SQL escapes are respected, so `''` inside a literal does not end it (`'it''s ?1'` is fully skipped). Edge cases: - There is no escape mechanism **outside** a literal: if a query needs literal `?` + digits text in an unquoted context, build that part with a `VSSql` fragment instead. - Matching only triggers on `?` immediately followed by a digit, so operators like PostgreSQL's `?` (JSONB key existence), `?|` and `?&` are unaffected.
> - Because `?1` is compiled through `adapter.getPlaceholder()`, the adapter must implement it — the constructor throws a `VSRepoError` if `vsPlaceholders` is enabled and the adapter doesn't. `@QueryMethod` also resolves through `getPlaceholder()`, so the same requirement applies.
> - This is independent of `VSSql` fragments: passing a `VSSql` to `query()` requires `getPlaceholder()` regardless of this option, and always compiles through it.

## Parameterized fragments with `VSSql`

`VSSql` is an ORM-agnostic, composable SQL fragment that compiles down to whatever placeholder syntax your adapter declares via `getPlaceholder()` — instead of assuming one. A `VSSql` never touches the database by itself: build one and pass it straight to `VSRepository.query()`, which compiles and executes it.

Values interpolated with `${...}` are **always** sent as bound parameters — never inlined into the SQL text — so fragments are safe from SQL injection by construction:

```typescript
import { VSSql } from "vsrepo";

const fragment = VSSql.sql`SELECT * FROM "user" WHERE email = ${email}`;
const users = await userRepository.query<User[]>(fragment);
```

### `VSSql.sql` — tagged template

Every interpolated `${value}` becomes a parameter, except another `VSSql` fragment, which is spliced in (its own text merged into the current one, its own parameters appended in order):

```typescript
const condition = VSSql.sql`AND active = ${true}`;
const fragment = VSSql.sql`
    SELECT * FROM "user" WHERE 1=1 ${condition}
`;
```

### `VSSql.raw` — trusted identifiers

Inserts `text` into the query **as-is, unparameterized** — for identifiers (table/column names) or SQL keywords that can't be bound as a parameter. `text` is never escaped or validated: **only pass trusted, non-user-controlled input**.

```typescript
const table = VSSql.raw('"user"');
const fragment = VSSql.sql`SELECT * FROM ${table} WHERE active = ${true}`;
```

### `VSSql.join` — parameterized lists

Joins `values` into a single fragment, separated by `separator` (default `", "`), wrapped by optional `prefix`/`suffix`. Each element is either a parameter value or a nested `VSSql` fragment. Most commonly used to build an `IN (...)` list:

```typescript
const ids = ["user-1", "user-2", "user-3"];

// compiles to WHERE id IN ($1, $2, $3)
const fragment = VSSql.sql`SELECT * FROM "user" WHERE id IN (${VSSql.join(ids)})`;
```

### `VSSql.empty` — conditional fragments

Contributes no text and no parameters — the "nothing" branch when conditionally composing a fragment:

```typescript
const onlyActive = true;

// compiles to AND active = $1 when onlyActive, and to nothing otherwise
const filter = onlyActive ? VSSql.sql`AND active = ${true}` : VSSql.empty;
```

### Composing fragments

Fragments compose freely — nest them as deep as you want, and the placeholder numbering stays correct. A realistic query combining everything above:

```typescript
const onlyActive = true;
const ids = ["user-1", "user-2", "user-3"];

const filter = onlyActive ? VSSql.sql`AND active = ${true}` : VSSql.empty;

const fragment = VSSql.sql`
    SELECT * FROM ${VSSql.raw('"user"')}
    WHERE id IN (${VSSql.join(ids)})
    ${filter}
`;

const users = await userRepository.query<User[]>(fragment);
```

> [!NOTE]
>
> - Passing a `VSSql` fragment to `query()` requires the adapter to implement `getPlaceholder()` — otherwise `query()` throws a `VSRepoError`. The adapter's other options (`modifying`, `singleResult`, `db`) keep working normally.
> - Values interpolated via `${...}` (including `join` elements) always become parameters; only `VSSql.raw` inserts text as-is. If you can't rule out user input for a table/column name, validate it against a static allowlist before hand — `raw` gives you no protection.

[⬆️ Back to top](#top)

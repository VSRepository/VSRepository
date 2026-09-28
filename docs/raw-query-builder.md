<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./raw-query-builder.pt-BR.md)

[← Back to the table of contents](./README.md)

# Raw query builder

`createRawQueryBuilder(db?)` returns a fluent, ORM-agnostic SQL builder for hand-written **`SELECT`** queries whose SQL is too specific (window functions, vendor-specific syntax, ad-hoc subqueries, CTEs, ...) to express through [`createQueryBuilder()`](./query-builder.md)'s model. It's available on every `VSRepository` instance and goes through the same adapter as every other method:

```typescript
import { VSSql } from "vsrepo";

const rows = await invoiceRepository
    .createRawQueryBuilder()
    .select("i.id", "i.total", "u.name")
    .from("invoice", "i")
    .innerJoin("user", "u", "u.id = i.user_id")
    .where(VSSql.sql`u.active = ${true}`)
    .andWhere("i.deleted_at is null")
    .groupBy("i.id", "u.name")
    .having(VSSql.sql`count(*) > ${1}`)
    .orderBy("i.total", "desc")
    .limit(20)
    .offset(0)
    .execute<{ id: string; total: number; name: string }[]>();
```

Nothing reaches the database until [`execute()`](#running-the-query) is called. The builder is **mutable**: every chained call changes the same instance and returns it, so use [`clone()`](#reusing-and-cloning-a-builder) to derive variations from a common base.

Requires the adapter to implement `getPlaceholder()` — same requirement as [`VSSql`](./query-methods.md#parameterized-fragments-with-vssql) — since `toSql()`/`execute()` compile the query through it. Calling either without it throws a `VSRepoError`.

## Building the query

Every clause accepts a raw, trusted string (an identifier for `select`/`from`/`groupBy`/`orderBy`, or a plain condition for `on`/`where`/`having`, passed through as-is — never pass user-controlled input) or a [`VSSql`](./query-methods.md#parameterized-fragments-with-vssql) fragment for anything parameterized or aliased:

| Method                                                                 | Description                                                                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `select(...columns)`                                                   | Columns/expressions to select, replacing any previous `select`. No arguments is equivalent to `SELECT *`.                                        |
| `from(target, alias?)`                                                 | The `FROM` target, replacing any previous one. See [Subqueries](#subqueries).                                                                    |
| `innerJoin/leftJoin/rightJoin/fullJoin(target, alias, on)`             | Adds a join. `target` accepts the same values as `from()`; `on` is a raw condition string or a `VSSql` fragment.                                 |
| `where(condition)` / `andWhere(condition)`                             | Adds a `WHERE` condition. The first call sets the filter; every later `where`/`andWhere` is `AND`-combined with it, each wrapped in parentheses. |
| `orWhere(condition)`                                                   | `OR`-combines `condition` with the existing `WHERE` filter.                                                                                      |
| `groupBy(...columns)`                                                  | Adds columns to `GROUP BY`. Each call appends.                                                                                                   |
| `having(condition)` / `andHaving(condition)` / `orHaving(condition)`   | Same `AND`/`OR` semantics as `where`/`andWhere`/`orWhere`, for `HAVING`.                                                                         |
| `orderBy(column, direction?)`                                          | Adds a column to `ORDER BY`. Each call appends, so call it once per column for a multi-column ordering. `direction` is `"asc"`/`"desc"`.         |
| `limit(limit)`                                                         | Maximum number of rows. Must be a non-negative integer.                                                                                          |
| `offset(offset)`                                                       | Number of rows to skip. Must be a non-negative integer.                                                                                          |
| `with(name, query, columns?)` / `withRecursive(name, query, columns?)` | Adds a `WITH` (CTE). See [CTEs with `with()`/`withRecursive()`](#ctes-with-withwithrecursive).                                                   |

## Subqueries

`from()` and every `join()` accept, besides a raw table name or a `VSSql` fragment, another `VSRawQueryBuilder` (compiled inline and wrapped in parentheses) or a **subquery function** — `sub => sub.select(...)...` — which receives a fresh builder sharing this one's `db`/adapter/logger, so you don't have to call `createRawQueryBuilder()` again for it:

```typescript
// Subquery builder passed directly
const recentInvoices = invoiceRepository
    .createRawQueryBuilder()
    .select("*")
    .from("invoice")
    .where(VSSql.sql`created_at > now() - interval '7 days'`);

const perUser = await invoiceRepository
    .createRawQueryBuilder()
    .select("user_id", VSSql.sql`count(*) AS total`)
    .from(recentInvoices, "recent")
    .groupBy("user_id")
    .execute();

// Subquery function, inline
const qb = userRepository
    .createRawQueryBuilder()
    .select("u.id")
    .from("user", "u")
    .innerJoin(sub => sub.select("user_id").from("invoice").groupBy("user_id"), "i", VSSql.sql`i.user_id = u.id`);
```

A subquery can also be spliced directly into a `VSSql` fragment anywhere — most commonly inside a `WHERE ... IN (...)` — via [`toVSSql()`](#running-the-query):

```typescript
const usersWithInvoices = await userRepository
    .createRawQueryBuilder()
    .select("*")
    .from("user")
    .where(VSSql.sql`id IN (${invoiceRepository.createRawQueryBuilder().select("user_id").from("invoice").toVSSql()})`)
    .execute();
```

## CTEs with `with()`/`withRecursive()`

`with(name, query, columns?)` adds a `WITH` (common table expression) that any later `from()`/`join()`/subquery in the same builder can reference by `name`, just like a real table. Each call adds one CTE; call it again to add more — they're all listed under a single `WITH`, in the order added. `query` accepts the same values as a [subquery](#subqueries) (a `VSRawQueryBuilder`, a subquery function, or a `VSSql` fragment), and `columns` is an optional explicit column list, rendered as `name(col1, col2) AS (...)`:

```typescript
const rows = await invoiceRepository
    .createRawQueryBuilder()
    .with("big_spenders", qb => qb.select("user_id").from("invoice").groupBy("user_id").having("sum(total) > 1000"))
    .select("u.*")
    .from("user", "u")
    .innerJoin("big_spenders", "bs", "bs.user_id = u.id")
    .execute();
```

`withRecursive(name, query, columns?)` is the same, but marks the whole `WITH` clause as `RECURSIVE` — required by the SQL standard for a CTE that references itself in its own body. Since a single `SELECT` builder can't express a `UNION`, the recursive body is usually a `VSSql` fragment:

```typescript
const orgChart = await employeeRepository
    .createRawQueryBuilder()
    .withRecursive(
        "subordinates",
        VSSql.sql`
            SELECT id, manager_id, 1 AS depth FROM employee WHERE id = ${managerId}
            UNION ALL
            SELECT e.id, e.manager_id, s.depth + 1 FROM employee e
            INNER JOIN subordinates s ON e.manager_id = s.id
        `,
        ["id", "manager_id", "depth"],
    )
    .select("*")
    .from("subordinates")
    .orderBy("depth")
    .execute();
```

One recursive CTE is enough to make the whole clause `WITH RECURSIVE`, even when combined with other, non-recursive ones added via `with()`.

## Running the query

| Method         | Returns      | Description                                                                                                                                                                                                                                                                              |
| -------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toVSSql()`    | `VSSql`      | Compiles every clause into a single `VSSql` fragment, in the order `WITH` → `SELECT` → `FROM` → `JOIN`s → `WHERE` → `GROUP BY` → `HAVING` → `ORDER BY` → `LIMIT` → `OFFSET`. Nothing runs — splice the result into another fragment as a subquery, or pass it to `VSRepository.query()`. |
| `toSql()`      | `string`     | Compiles down to a plain SQL string, rendered with the adapter's own placeholder syntax (`$1`, `$2`, ... or `?`). Values are **not** interpolated — use `toVSSql()` (`.compile()`) if you also need them.                                                                                |
| `execute<T>()` | `Promise<T>` | Compiles and runs the query through the adapter, returning whatever `adapter.query()` resolves to for this SQL (typically the matching rows). `T` defaults to `any`.                                                                                                                     |

`toVSSql()` throws a `VSRepoError` if no `from()` target was set (`select()` alone defaults to `SELECT *`, so it's never the one missing). `toSql()`/`execute()` additionally throw if the adapter doesn't implement `getPlaceholder()`.

## Transactions and `setDb()`

`createRawQueryBuilder(db?)` accepts the client or transaction to run in. Since nothing runs until `execute()` is called, you can also build the query first and choose where it runs later with `setDb()`:

```typescript
const qb = invoiceRepository.createRawQueryBuilder().select("*").from("invoice");

await invoiceRepository.transaction(async tx => {
    qb.setDb(tx); // from here on, execute() runs inside the transaction
    return qb.execute();
});
```

`setDb()` is also handy together with `clone()` to run the same query against another client without touching the original builder.

## Reusing and cloning a builder

`clone()` returns an independent builder with the same clauses (including any CTEs) and `db`. Changes made to either one afterwards don't affect the other:

```typescript
const base = userRepository
    .createRawQueryBuilder()
    .select("id")
    .from("user")
    .where(VSSql.sql`active = ${true}`);

const withAdmins = await base.clone().andWhere("is_admin = true").execute();
const withMinAge = await base
    .clone()
    .andWhere(VSSql.sql`age > ${18}`)
    .execute();
```

## Validation and errors

Arguments are validated as soon as they're passed to a chained method, not when the query runs. An invalid one throws a `VSRepoError` with `type: VSRepoErrorType.QUERY_BUILDER`, whose message starts with the offending argument, and leaves the builder unchanged. `limit` and `offset` must be non-negative integers. Every raw string accepted as an identifier, condition, alias or CTE name/column (as opposed to a `VSSql` fragment) must be non-empty/non-blank — an empty one would otherwise silently compile into broken SQL (a trailing comma, an empty `WHERE ()`, ...) instead of failing where you called it:

- `select`/`groupBy`/`orderBy` columns, and `where`/`andWhere`/`orWhere`/`having`/`andHaving`/`orHaving`/`on` conditions, when passed as a string
- `from`/join `alias`, when given
- `with`/`withRecursive`'s `name`, and every item of its optional `columns`

This is a presence check only — the library never parses or otherwise validates the _content_ of a raw SQL string.

```typescript
import { VSRepoError, VSRepoErrorType } from "vsrepo";

try {
    userRepository.createRawQueryBuilder().limit(-1);
} catch (error) {
    if (error instanceof VSRepoError && error.type === VSRepoErrorType.QUERY_BUILDER) {
        console.error(error.message);
    }
}
```

Errors thrown by the adapter while the query runs (e.g. `VSRepoAdapterError`) are not wrapped — they reach you unchanged.

## Raw query builder logs

The builder uses the repository's logger, so it follows the same `logLevel` and `logSlowThresholdMs` (see [Logging](./logging.md#logging)):

- `DEBUG` traces `setDb`/`clone` calls and, before `execute()` runs, the compiled query and its args. The `db` is never logged.
- `execute()` is timed as `run raw query builder execute`: the duration is logged at `DEBUG` and promoted to `WARN` when it exceeds `logSlowThresholdMs`.

[⬆️ Back to top](#top)

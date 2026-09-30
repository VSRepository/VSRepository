import { VSRepoError } from "../../errors/VSRepoError.js";
import { VSRawQueryBuilderCteQuery } from "../../types/vsrepo/vs-raw-query-builder-cte-query.type.js";
import { VSRawQueryBuilderTarget } from "../../types/vsrepo/vs-raw-query-builder-target.type.js";
import { VSRepoOrmTypes } from "../../types/vsrepo/vsrepo-orm-types.type.js";
import { VSRepoAdapter } from "../../VSRepoAdapter.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
import { VSLogger } from "./vs-logger.util.js";
import { VSSql } from "./vs-sql.util.js";

type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL";
type Connector = "AND" | "OR";

interface JoinClause {
    type: JoinType;
    target: VSSql;
    on: VSSql;
}

interface Condition {
    connector: Connector;
    sql: VSSql;
}

interface CteClause {
    name: string;
    columns?: string[];
    query: VSSql;
}

/**
 * Fluent, SQL-agnostic builder for hand-written **`SELECT`** queries whose shape is only known
 * at runtime, but whose SQL is too specific (window functions, CTEs referenced elsewhere,
 * vendor-specific syntax, ...) to express through {@link VSQueryBuilder}'s `where`/`relations`
 * model. Compiles down to a single {@link VSSql} fragment — get one from
 * `VSRepository.createRawQueryBuilder()`.
 *
 * Nothing reaches the database until {@link VSRawQueryBuilder.execute} is called. The builder is
 * **mutable**: every chained call changes the same instance and returns it. Use
 * {@link VSRawQueryBuilder.clone} to derive variations from a common base.
 *
 * @example
 * ```typescript
 * import { VSSql } from "vsrepo";
 *
 * const rows = await orderRepository
 *     .createRawQueryBuilder()
 *     .select("o.id", "o.total", "u.name")
 *     .from("order", "o")
 *     .innerJoin("user", "u", "u.id = o.user_id")
 *     .where(VSSql.sql`u.active = ${true}`)
 *     .andWhere(VSSql.sql`o.total > ${100}`)
 *     .andWhere("o.deleted_at is null")
 *     .groupBy("o.id", "u.name")
 *     .having(VSSql.sql`count(*) > ${1}`)
 *     .orderBy("o.total", "desc")
 *     .limit(20)
 *     .offset(0)
 *     .execute<{ id: string; total: number; name: string }[]>();
 * ```
 *
 * @publicApi
 */
export class VSRawQueryBuilder<OrmTypes extends VSRepoOrmTypes = VSRepoOrmTypes> {
    private cteClauses: CteClause[] = [];
    private recursiveWith = false;
    private selectColumns: VSSql[] = [];
    private fromTarget?: VSSql;
    private joinClauses: JoinClause[] = [];
    private whereConditions: Condition[] = [];
    private groupByColumns: VSSql[] = [];
    private havingConditions: Condition[] = [];
    private orderByClauses: VSSql[] = [];
    private limitValue?: number;
    private offsetValue?: number;

    /**
     * @internal
     */
    constructor(
        private db: OrmTypes["dbClient"] | OrmTypes["dbTransaction"],
        private readonly adapter: VSRepoAdapter<any>,
        private readonly logger?: VSLogger,
    ) {}

    private trace(message: string, obj?: unknown): void {
        this.logger?.logDebug(`VSRawQueryBuilder: ${message}`, obj);
    }

    private static validateNonEmptyString(value: string, context: string): void {
        if (value.trim().length === 0) {
            throw new VSRepoError(
                `${context}: Invalid value: Expected a non-empty string but received ${value}`,
                VSRepoErrorType.QUERY_BUILDER,
            );
        }
    }

    /** Converts a raw string into a `VSSql.raw` fragment (validating it isn't empty/blank first,
     * since that would silently compile into broken SQL — e.g. a trailing comma or an empty
     * `WHERE ()`) or passes an already-built `VSSql` fragment through untouched.
     *
     * @param context Name of the calling method/argument, used in the `VSRepoError` message. */
    private static toFragment(value: string | VSSql, context: string): VSSql {
        if (typeof value !== "string") {
            return value;
        }

        VSRawQueryBuilder.validateNonEmptyString(value, context);

        return VSSql.raw(value);
    }

    private newSubBuilder(): VSRawQueryBuilder<OrmTypes> {
        return new VSRawQueryBuilder<OrmTypes>(this.db, this.adapter, this.logger);
    }

    private resolveSubquery(value: VSRawQueryBuilder | ((sub: VSRawQueryBuilder) => VSRawQueryBuilder | VSSql)): VSSql {
        const result = typeof value === "function" ? value(this.newSubBuilder()) : value;

        return result instanceof VSRawQueryBuilder ? result.toVSSql() : result;
    }

    private resolveTarget(target: VSRawQueryBuilderTarget, context: string, alias?: string): VSSql {
        const base =
            target instanceof VSRawQueryBuilder || typeof target === "function"
                ? VSSql.sql`(${this.resolveSubquery(target)})`
                : VSRawQueryBuilder.toFragment(target, context);

        if (alias === undefined) {
            return base;
        }

        VSRawQueryBuilder.validateNonEmptyString(alias, "alias");

        return VSSql.sql`${base} AS ${VSSql.raw(alias)}`;
    }

    private resolveCteQuery(query: VSRawQueryBuilderCteQuery): VSSql {
        return query instanceof VSSql ? query : this.resolveSubquery(query);
    }

    private static combine(conditions: Condition[]): VSSql {
        let result = VSSql.sql`(${conditions[0]!.sql})`;

        for (let i = 1; i < conditions.length; i++) {
            const { connector, sql } = conditions[i]!;
            result = connector === "AND" ? VSSql.sql`${result} AND (${sql})` : VSSql.sql`${result} OR (${sql})`;
        }

        return result;
    }

    private static validateNonNegativeInt(value: number, name: "limit" | "offset"): void {
        if (!Number.isInteger(value) || value < 0) {
            throw new VSRepoError(
                `${name}: Invalid value: Expected >=0 but received ${value}`,
                VSRepoErrorType.QUERY_BUILDER,
            );
        }
    }

    /**
     * Sets the columns to select, replacing any previous `select`. Each column is either a raw,
     * trusted string (an identifier, passed through as-is — like `VSSql.raw`, never pass
     * user-controlled input) or a `VSSql` fragment for anything parameterized or aliased
     * (**VSSql.sql\`count(*) AS total\`**).
     *
     * @param columns One or more columns/expressions. `select()` with no arguments is equivalent
     * to `SELECT *`.
     */
    select(...columns: (string | VSSql)[]): this {
        this.selectColumns = columns.length
            ? columns.map(column => VSRawQueryBuilder.toFragment(column, "select"))
            : [VSSql.raw("*")];

        return this;
    }

    /**
     * Sets the `FROM` target, replacing any previous one.
     *
     * @param target A raw table name, a `VSSql` fragment, or another `VSRawQueryBuilder`
     * (compiled inline as a subquery, wrapped in parentheses).
     * @param alias Optional alias, appended as `AS alias` (raw, trusted text).
     */
    from(target: VSRawQueryBuilderTarget, alias?: string): this {
        this.fromTarget = this.resolveTarget(target, "from", alias);

        return this;
    }

    private addCte(name: string, query: VSRawQueryBuilderCteQuery, columns?: string[]): this {
        VSRawQueryBuilder.validateNonEmptyString(name, "with");

        if (columns) {
            for (let i = 0; i < columns.length; i++) {
                const column = columns[i]!;
                VSRawQueryBuilder.validateNonEmptyString(column, `with columns[${i}]`);
            }
        }

        this.cteClauses.push({ name, columns, query: this.resolveCteQuery(query) });

        return this;
    }

    /**
     * Adds a `WITH` (common table expression). Each call adds one CTE; call it
     * again to add more — they're all listed under a single `WITH`, in the order added.
     *
     * @param name Name the CTE is referenced by elsewhere in the query (raw, trusted text).
     * @param query The CTE's body: a `VSRawQueryBuilder`, a subquery function, or a `VSSql` fragment — needed for
     * anything a single `SELECT` builder can't express (e.g. a `UNION`).
     * @param columns Optional explicit column list, rendered as `name(col1, col2) AS (...)`.
     *
     * @example
     * ```typescript
     * const rows = await orderRepository
     *     .createRawQueryBuilder()
     *     .with("big_spenders", qb => qb.select("user_id").from("order").groupBy("user_id").having("sum(total) > 1000"))
     *     .select("u.*")
     *     .from("user", "u")
     *     .innerJoin("big_spenders", "bs", "bs.user_id = u.id")
     *     .execute();
     * ```
     */
    with(name: string, query: VSRawQueryBuilderCteQuery, columns?: string[]): this {
        return this.addCte(name, query, columns);
    }

    /**
     * Same as {@link VSRawQueryBuilder.with}, but marks the whole `WITH` clause as `RECURSIVE`
     * (required by the SQL standard for a CTE that references itself in its own body — usually
     * a `VSSql` fragment with a `... UNION ALL SELECT ... FROM name ...` shape). One recursive
     * CTE is enough to make the whole clause `WITH RECURSIVE`, even when combined with other,
     * non-recursive ones added via {@link VSRawQueryBuilder.with}.
     *
     * @example
     * ```typescript
     * const orgChart = await employeeRepository
     *     .createRawQueryBuilder()
     *     .withRecursive(
     *         "subordinates",
     *         VSSql.sql`
     *             SELECT id, manager_id, 1 AS depth FROM employee WHERE id = ${managerId}
     *             UNION ALL
     *             SELECT e.id, e.manager_id, s.depth + 1 FROM employee e
     *             INNER JOIN subordinates s ON e.manager_id = s.id
     *         `,
     *         ["id", "manager_id", "depth"],
     *     )
     *     .select("*")
     *     .from("subordinates")
     *     .orderBy("depth")
     *     .execute();
     * ```
     */
    withRecursive(name: string, query: VSRawQueryBuilderCteQuery, columns?: string[]): this {
        this.recursiveWith = true;

        return this.addCte(name, query, columns);
    }

    private addJoin(type: JoinType, target: VSRawQueryBuilderTarget, alias: string, on: string | VSSql): this {
        this.joinClauses.push({
            type,
            target: this.resolveTarget(target, "join", alias),
            on: VSRawQueryBuilder.toFragment(on, "on"),
        });

        return this;
    }

    /**
     * Adds an `INNER JOIN`.
     */
    innerJoin(target: VSRawQueryBuilderTarget, alias: string, on: string | VSSql): this {
        return this.addJoin("INNER", target, alias, on);
    }

    /**
     * Adds a `LEFT JOIN`.
     */
    leftJoin(target: VSRawQueryBuilderTarget, alias: string, on: string | VSSql): this {
        return this.addJoin("LEFT", target, alias, on);
    }

    /**
     * Adds a `RIGHT JOIN`.
     */
    rightJoin(target: VSRawQueryBuilderTarget, alias: string, on: string | VSSql): this {
        return this.addJoin("RIGHT", target, alias, on);
    }

    /**
     * Adds a `FULL JOIN`.
     */
    fullJoin(target: VSRawQueryBuilderTarget, alias: string, on: string | VSSql): this {
        return this.addJoin("FULL", target, alias, on);
    }

    /**
     * Adds a `WHERE` condition. The first call sets the filter; every later call (`where` or
     * {@link VSRawQueryBuilder.andWhere}) is `AND`-combined with it, each wrapped in parentheses.
     * Use {@link VSRawQueryBuilder.orWhere} to `OR`-combine instead.
     */
    where(condition: string | VSSql): this {
        this.whereConditions.push({ connector: "AND", sql: VSRawQueryBuilder.toFragment(condition, "where") });

        return this;
    }

    /** Alias for {@link VSRawQueryBuilder.where} — `AND`-combines `condition` with the existing filter. */
    andWhere(condition: string | VSSql): this {
        this.whereConditions.push({ connector: "AND", sql: VSRawQueryBuilder.toFragment(condition, "andWhere") });

        return this;
    }

    /** `OR`-combines `condition` with the existing `WHERE` filter. */
    orWhere(condition: string | VSSql): this {
        this.whereConditions.push({ connector: "OR", sql: VSRawQueryBuilder.toFragment(condition, "orWhere") });

        return this;
    }

    /**
     * Adds columns to `GROUP BY`. Each call appends; call {@link VSRawQueryBuilder.clone} from a
     * common base if you need independent variations.
     */
    groupBy(...columns: (string | VSSql)[]): this {
        this.groupByColumns.push(...columns.map(column => VSRawQueryBuilder.toFragment(column, "groupBy")));

        return this;
    }

    /**
     * Adds a `HAVING` condition, `AND`-combined with any previous one (same semantics as
     * {@link VSRawQueryBuilder.where}). Use {@link VSRawQueryBuilder.orHaving} to `OR`-combine.
     */
    having(condition: string | VSSql): this {
        this.havingConditions.push({ connector: "AND", sql: VSRawQueryBuilder.toFragment(condition, "having") });

        return this;
    }

    /** Alias for {@link VSRawQueryBuilder.having} — `AND`-combines `condition` with the existing `HAVING` filter. */
    andHaving(condition: string | VSSql): this {
        this.havingConditions.push({ connector: "AND", sql: VSRawQueryBuilder.toFragment(condition, "andHaving") });

        return this;
    }

    /** `OR`-combines `condition` with the existing `HAVING` filter. */
    orHaving(condition: string | VSSql): this {
        this.havingConditions.push({ connector: "OR", sql: VSRawQueryBuilder.toFragment(condition, "orHaving") });

        return this;
    }

    /**
     * Adds a column to `ORDER BY`. Each call appends, in order, so call it once per column for a
     * multi-column ordering.
     */
    orderBy(column: string | VSSql, direction?: "asc" | "desc" | "ASC" | "DESC"): this {
        const base = VSRawQueryBuilder.toFragment(column, "orderBy");

        this.orderByClauses.push(direction ? VSSql.sql`${base} ${VSSql.raw(direction.toUpperCase())}` : base);

        return this;
    }

    /**
     * Sets the maximum number of rows to return, replacing any previous `limit`.
     */
    limit(limit: number): this {
        VSRawQueryBuilder.validateNonNegativeInt(limit, "limit");
        this.limitValue = limit;

        return this;
    }

    /**
     * Sets how many rows to skip, replacing any previous `offset`.
     */
    offset(offset: number): this {
        VSRawQueryBuilder.validateNonNegativeInt(offset, "offset");
        this.offsetValue = offset;

        return this;
    }

    /**
     * Sets the client or transaction the query runs on, replacing the one given to
     * `createRawQueryBuilder()`.
     *
     * It's lazy — it only matters when {@link VSRawQueryBuilder.execute} runs — so a builder can
     * be created before a transaction and pointed at it from inside, or a
     * {@link VSRawQueryBuilder.clone} can be pointed at another client without touching the
     * original builder.
     *
     * @example
     * ```typescript
     * const qb = orderRepository.createRawQueryBuilder().select("*").from("order");
     *
     * await orderRepository.transaction(async tx => {
     *     qb.setDb(tx);
     *     return qb.execute();
     * });
     * ```
     */
    setDb(db: OrmTypes["dbClient"] | OrmTypes["dbTransaction"]): void {
        this.db = db;

        this.trace("db replaced");
    }

    /**
     * Returns an independent builder with the same clauses and `db`. Changes made to either one
     * afterwards don't affect the other (the underlying `VSSql`/`VSRawQueryBuilder` values
     * themselves are immutable, so a shallow copy of every clause array is enough).
     */
    clone(): VSRawQueryBuilder<OrmTypes> {
        const copy = new VSRawQueryBuilder<OrmTypes>(this.db, this.adapter, this.logger);

        copy.recursiveWith = this.recursiveWith;
        copy.cteClauses = [...this.cteClauses];
        copy.selectColumns = [...this.selectColumns];
        copy.fromTarget = this.fromTarget;
        copy.joinClauses = [...this.joinClauses];
        copy.whereConditions = [...this.whereConditions];
        copy.groupByColumns = [...this.groupByColumns];
        copy.havingConditions = [...this.havingConditions];
        copy.orderByClauses = [...this.orderByClauses];
        copy.limitValue = this.limitValue;
        copy.offsetValue = this.offsetValue;

        this.trace("clone");

        return copy;
    }

    private compileCteClause(): VSSql {
        const ctes = this.cteClauses.map(({ name, columns, query }) => {
            const columnList = columns?.length ? VSSql.sql`(${VSSql.raw(columns.join(", "))}) ` : VSSql.empty;

            return VSSql.sql`${VSSql.raw(name)} ${columnList}AS (${query})`;
        });

        return VSSql.sql`WITH ${this.recursiveWith ? VSSql.raw("RECURSIVE ") : VSSql.empty}${VSSql.join(ctes, ", ")}`;
    }

    /**
     * Compiles every configured clause into a single {@link VSSql} fragment, in the order
     * `WITH` (CTEs) -> `SELECT` -> `FROM` -> `JOIN`s -> `WHERE` -> `GROUP BY` -> `HAVING` -> `ORDER BY`
     * -> `LIMIT` -> `OFFSET`. Nothing runs by itself — splice the result into another `VSSql`
     * fragment as a subquery, or pass it to `VSRepository.query()`.
     */
    toVSSql(): VSSql {
        if (!this.fromTarget) {
            throw new VSRepoError("'from' is required before calling 'toVSSql'", VSRepoErrorType.QUERY_BUILDER);
        }

        const select = this.selectColumns.length ? VSSql.join(this.selectColumns, ", ") : VSSql.raw("*");

        let query = VSSql.sql`SELECT ${select} FROM ${this.fromTarget}`;

        for (const { type, target, on } of this.joinClauses) {
            query = VSSql.sql`${query} ${VSSql.raw(`${type} JOIN`)} ${target} ON ${on}`;
        }

        if (this.whereConditions.length) {
            query = VSSql.sql`${query} WHERE ${VSRawQueryBuilder.combine(this.whereConditions)}`;
        }

        if (this.groupByColumns.length) {
            query = VSSql.sql`${query} GROUP BY ${VSSql.join(this.groupByColumns, ", ")}`;
        }

        if (this.havingConditions.length) {
            query = VSSql.sql`${query} HAVING ${VSRawQueryBuilder.combine(this.havingConditions)}`;
        }

        if (this.orderByClauses.length) {
            query = VSSql.sql`${query} ORDER BY ${VSSql.join(this.orderByClauses, ", ")}`;
        }

        if (this.limitValue !== undefined) {
            query = VSSql.sql`${query} LIMIT ${this.limitValue}`;
        }

        if (this.offsetValue !== undefined) {
            query = VSSql.sql`${query} OFFSET ${this.offsetValue}`;
        }

        if (this.cteClauses.length) {
            query = VSSql.sql`${this.compileCteClause()} ${query}`;
        }

        return query;
    }

    private compileForAdapter(): { text: string; args: unknown[] } {
        if (!this.adapter.getPlaceholder) {
            throw new VSRepoError(
                "Your adapter did not implement the 'getPlaceholder' method, required to compile a " +
                    "'VSRawQueryBuilder'; try updating your adapter to a newer version.",
                VSRepoErrorType.QUERY_BUILDER,
            );
        }

        return this.toVSSql().compile(index => this.adapter.getPlaceholder!(index));
    }

    /**
     * Compiles the builder down to a plain SQL string, rendered with the adapter's own
     * placeholder syntax (e.g. `$1`, `$2`, ...). Values themselves are **not** interpolated into
     * the string — use {@link VSRawQueryBuilder.toVSSql} (`.compile()`) or
     * {@link VSRawQueryBuilder.execute} if you also need the parameter values/to run the query.
     */
    toSql(): string {
        return this.compileForAdapter().text;
    }

    /**
     * Compiles and runs the query against the underlying database, through the same adapter as
     * every other `VSRepository` method.
     *
     * @template T Shape of the returned rows. Defaults to `any`.
     */
    async execute<T = any>(): Promise<T> {
        const { text, args } = this.compileForAdapter();

        this.trace("execute", { query: text, args });

        const start = this.logger?.startPerformLog("run raw query builder execute");

        try {
            return await this.adapter.query<T>(text, { args, db: this.db, modifying: false });
        } finally {
            this.logger?.endPerformLog(start);
        }
    }
}

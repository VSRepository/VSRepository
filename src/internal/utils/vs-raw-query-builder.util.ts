import { VSRepoError } from "../../errors/VSRepoError.js";
import { ClientOrTransaction } from "../../types/utils/client-or-transaction.type.js";
import { CompiledQuery } from "../../types/utils/compiled-query.type.js";
import { OrderTuple } from "../../types/utils/order-tuple.type.js";
import { SortDirection } from "../../types/utils/ordering.type.js";
import { VSRawQueryBuilderCteQuery } from "../../types/vsrepo/vs-raw-query-builder-cte-query.type.js";
import { VSRawQueryBuilderTarget } from "../../types/vsrepo/vs-raw-query-builder-target.type.js";
import { VSRepoOrmTypes } from "../../types/vsrepo/vsrepo-orm-types.type.js";
import { VSRepoAdapter } from "../../VSRepoAdapter.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
import { VSLogger } from "./vs-logger.util.js";
import { VSSql } from "./vs-sql.util.js";

type JoinType = "inner" | "left" | "right" | "full";
type Connector = "and" | "or";

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
 * Fluent, SQL-agnostic builder for hand-written `select` queries that are too specific (window functions,
 * CTEs, vendor-specific syntax, ...) for `VSQueryBuilder`.
 *
 * Nothing reaches the database until `execute()` is called. The builder is mutable: use `clone()` to
 * derive variations. Plain strings are inserted into the SQL as-is (like `VSSql.raw`), so never pass
 * user-controlled input in them; use a `VSSql.sql` fragment for values.
 *
 * @example
 * ```typescript
 * const rows = await orderRepository
 *     .createRawQueryBuilder()
 *     .select("u.id", "u.name")
 *     .from("user", "u")
 *     .where(VSSql.sql`u.active = ${true}`)
 *     .orderBy("u.created_at", "desc")
 *     .limit(20)
 *     .execute<{ id: string; name: string }[]>();
 * ```
 *
 * @publicApi
 */
export class VSRawQueryBuilder<OrmTypes extends VSRepoOrmTypes = VSRepoOrmTypes> {
    private cteClauses: CteClause[] = [];
    private recursiveWith = false;
    private selectColumns: VSSql[] = [];
    private distinctSelectMode = false;
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
        private db: ClientOrTransaction<OrmTypes>,
        private readonly adapter: VSRepoAdapter<any>,
        private readonly logger: VSLogger,
    ) {}

    private trace(message: string, obj?: unknown): void {
        this.logger.logDebug(`VSRawQueryBuilder: ${message}`, obj);
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
     * `where ()`) or passes an already-built `VSSql` fragment through untouched.
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

        return VSSql.sql`${base} ${VSSql.raw(alias)}`;
    }

    private resolveCteQuery(query: VSRawQueryBuilderCteQuery): VSSql {
        return query instanceof VSSql ? query : this.resolveSubquery(query);
    }

    private static combine(conditions: Condition[]): VSSql {
        let result = VSSql.sql`(${conditions[0]!.sql})`;

        for (let i = 1; i < conditions.length; i++) {
            const { connector, sql } = conditions[i]!;
            result = connector === "and" ? VSSql.sql`${result} and (${sql})` : VSSql.sql`${result} or (${sql})`;
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
     * Sets the columns to select, replacing any previous `select`.
     *
     * @param columns Raw column strings or `VSSql` fragments. With no arguments, selects `*`.
     */
    select(...columns: (string | VSSql)[]): this {
        this.selectColumns = columns.length
            ? columns.map(column => VSRawQueryBuilder.toFragment(column, "select"))
            : [VSSql.raw("*")];

        this.distinctSelectMode = false;

        return this;
    }

    /**
     * Sets the columns for a distinct select, replacing any previous `select`.
     */
    selectDistinct(...columns: (string | VSSql)[]): this {
        if (!columns.length) {
            throw new VSRepoError(
                `At least one column must be provided to selectDistinct`,
                VSRepoErrorType.QUERY_BUILDER,
            );
        }

        this.selectColumns = columns.map(column => VSRawQueryBuilder.toFragment(column, "select"));

        this.distinctSelectMode = true;

        return this;
    }

    /**
     * Sets the `from` target, replacing any previous one.
     *
     * @param target Table name, `VSSql` fragment, or another builder (or a function receiving one),
     * which is compiled as a parenthesized subquery.
     * @param alias Optional alias, written right after the target (raw, trusted text).
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
     * Adds a CTE (`with`). Each call adds one, in the order added.
     *
     * @param name Name the CTE is referenced by (raw, trusted text).
     * @param query The CTE body: a builder, a function receiving a sub-builder, or a `VSSql` fragment.
     * @param columns Optional column list, rendered as `name(col1, col2) as (...)`.
     *
     * @example
     * ```typescript
     * qb.with("big_spenders", sub => sub.select("user_id").from("order").groupBy("user_id").having("sum(total) > 1000"))
     *     .select("u.*")
     *     .from("user", "u")
     *     .innerJoin("big_spenders", "bs", "bs.user_id = u.id");
     * ```
     */
    with(name: string, query: VSRawQueryBuilderCteQuery, columns?: string[]): this {
        return this.addCte(name, query, columns);
    }

    /**
     * Same as `with`, but makes the whole `with` clause `recursive`, as required by a CTE that references itself
     * (usually a `VSSql` fragment with a `union all`).
     *
     * @example
     * ```typescript
     * qb.withRecursive(
     *     "subordinates",
     *     VSSql.sql`
     *         select id, manager_id from employee where id = ${managerId}
     *         union all
     *         select e.id, e.manager_id from employee e join subordinates s on e.manager_id = s.id
     *     `,
     * ).from("subordinates");
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

    /** Adds an `inner join` on `target`, aliased as `alias`, using the `on` condition. */
    innerJoin(target: VSRawQueryBuilderTarget, alias: string, on: string | VSSql): this {
        return this.addJoin("inner", target, alias, on);
    }

    /** Adds a `left join` on `target`, aliased as `alias`, using the `on` condition. */
    leftJoin(target: VSRawQueryBuilderTarget, alias: string, on: string | VSSql): this {
        return this.addJoin("left", target, alias, on);
    }

    /** Adds a `right join` on `target`, aliased as `alias`, using the `on` condition. */
    rightJoin(target: VSRawQueryBuilderTarget, alias: string, on: string | VSSql): this {
        return this.addJoin("right", target, alias, on);
    }

    /** Adds a `full join` on `target`, aliased as `alias`, using the `on` condition. */
    fullJoin(target: VSRawQueryBuilderTarget, alias: string, on: string | VSSql): this {
        return this.addJoin("full", target, alias, on);
    }

    /**
     * Adds a `where` condition. Conditions are `and`-combined, each wrapped in parentheses;
     * use `orWhere` to `or`-combine instead.
     */
    where(condition: string | VSSql): this {
        this.whereConditions.push({ connector: "and", sql: VSRawQueryBuilder.toFragment(condition, "where") });

        return this;
    }

    /** Alias for `where`. */
    andWhere(condition: string | VSSql): this {
        this.whereConditions.push({ connector: "and", sql: VSRawQueryBuilder.toFragment(condition, "andWhere") });

        return this;
    }

    /** Adds a `where` condition `or`-combined with the previous ones. */
    orWhere(condition: string | VSSql): this {
        this.whereConditions.push({ connector: "or", sql: VSRawQueryBuilder.toFragment(condition, "orWhere") });

        return this;
    }

    /** Adds columns to `group by`. Each call appends. */
    groupBy(...columns: (string | VSSql)[]): this {
        this.groupByColumns.push(...columns.map(column => VSRawQueryBuilder.toFragment(column, "groupBy")));

        return this;
    }

    /**
     * Adds a `having` condition. Same semantics as `where`: `and`-combined by default,
     * use `orHaving` to `or`-combine.
     */
    having(condition: string | VSSql): this {
        this.havingConditions.push({ connector: "and", sql: VSRawQueryBuilder.toFragment(condition, "having") });

        return this;
    }

    /** Alias for `having`. */
    andHaving(condition: string | VSSql): this {
        this.havingConditions.push({ connector: "and", sql: VSRawQueryBuilder.toFragment(condition, "andHaving") });

        return this;
    }

    /** Adds a `having` condition `or`-combined with the previous ones. */
    orHaving(condition: string | VSSql): this {
        this.havingConditions.push({ connector: "or", sql: VSRawQueryBuilder.toFragment(condition, "orHaving") });

        return this;
    }

    /**
     * Adds columns to `order by`, either one column with an optional direction or a list of
     * `[column, direction]` tuples. Each call appends.
     */
    orderBy(column: string | VSSql, direction?: SortDirection): this;
    /** Adds a list of `[column, direction]` tuples to `order by`. */
    orderBy(orders: OrderTuple[]): this;
    orderBy(columnOrOrders: string | VSSql | OrderTuple[], direction?: SortDirection): this {
        const orders: OrderTuple[] = Array.isArray(columnOrOrders) ? columnOrOrders : [[columnOrOrders, direction]];

        for (let i = 0; i < orders.length; i++) {
            const order = orders[i]!;

            const base = VSRawQueryBuilder.toFragment(order[0], "orderBy");

            this.orderByClauses.push(order[1] ? VSSql.sql`${base} ${VSSql.raw(order[1].toUpperCase())}` : base);
        }

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
     * Sets the client or transaction the query runs on, replacing the one given to `createRawQueryBuilder()`.
     * It only matters when `execute()` runs, so a builder can be created first and pointed at a transaction later.
     *
     * @example
     * ```typescript
     * const qb = orderRepository.createRawQueryBuilder().select("*").from("order");
     *
     * await orderRepository.transaction(async tx => qb.setDb(tx).execute());
     * ```
     */
    setDb(db: ClientOrTransaction<OrmTypes>): this {
        this.db = db;

        this.trace("db replaced");

        return this;
    }

    /** Returns an independent builder with the same clauses and `db`. */
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
        copy.distinctSelectMode = this.distinctSelectMode;

        this.trace("clone");

        return copy;
    }

    private compileCteClause(): VSSql {
        const ctes = this.cteClauses.map(({ name, columns, query }) => {
            const columnList = columns?.length ? VSSql.sql`(${VSSql.raw(columns.join(", "))}) ` : VSSql.empty;

            return VSSql.sql`${VSSql.raw(name)} ${columnList}as (${query})`;
        });

        return VSSql.sql`with ${this.recursiveWith ? VSSql.raw("recursive ") : VSSql.empty}${VSSql.join(ctes, ", ")}`;
    }

    /**
     * Compiles the builder into a `VSSql` fragment, to use as a subquery or pass to `VSRepository.query()`.
     * Clauses are emitted as: `with`, `select`, `from`, joins, `where`, `group by`, `having`, `order by`, `limit`, `offset`.
     */
    toVSSql(): VSSql {
        if (!this.fromTarget) {
            throw new VSRepoError("'from' is required before calling 'toVSSql'", VSRepoErrorType.QUERY_BUILDER);
        }

        const select = this.selectColumns.length ? VSSql.join(this.selectColumns, ", ") : VSSql.raw("*");
        const distinctFragment = this.distinctSelectMode ? VSSql.raw("distinct ") : VSSql.empty;

        let query = VSSql.sql`select ${distinctFragment}${select} from ${this.fromTarget}`;

        for (const { type, target, on } of this.joinClauses) {
            query = VSSql.sql`${query} ${VSSql.raw(`${type} join`)} ${target} on ${on}`;
        }

        if (this.whereConditions.length) {
            query = VSSql.sql`${query} where ${VSRawQueryBuilder.combine(this.whereConditions)}`;
        }

        if (this.groupByColumns.length) {
            query = VSSql.sql`${query} group by ${VSSql.join(this.groupByColumns, ", ")}`;
        }

        if (this.havingConditions.length) {
            query = VSSql.sql`${query} having ${VSRawQueryBuilder.combine(this.havingConditions)}`;
        }

        if (this.orderByClauses.length) {
            query = VSSql.sql`${query} order by ${VSSql.join(this.orderByClauses, ", ")}`;
        }

        if (this.limitValue !== undefined) {
            query = VSSql.sql`${query} limit ${this.limitValue}`;
        }

        if (this.offsetValue !== undefined) {
            query = VSSql.sql`${query} offset ${this.offsetValue}`;
        }

        if (this.cteClauses.length) {
            query = VSSql.sql`${this.compileCteClause()} ${query}`;
        }

        return query;
    }

    private compileForAdapter(): CompiledQuery {
        return this.toVSSql().compile(index => this.adapter.getPlaceholder(index));
    }

    /**
     * Compiles the builder into a SQL string using the adapter's placeholders (e.g. `$1`).
     * Parameter values aren't included: use `toVSSql().compile()` to get them too.
     */
    toSql(): string {
        return this.compileForAdapter().query;
    }

    /**
     * Compiles and runs the query through the adapter.
     *
     * @template T Shape of the returned rows.
     */
    async execute<T = any>(): Promise<T> {
        const { query: text, args } = this.compileForAdapter();

        this.trace("execute", { query: text, args });

        const start = this.logger.startPerformLog("run raw query builder execute");

        try {
            const result = await this.adapter.query<T>(text, { args, db: this.db, modifying: false });
            this.logger.endPerformLog(start);

            return result;
        } catch (err) {
            this.logger.endPerformLog(start);

            throw err;
        }
    }
}

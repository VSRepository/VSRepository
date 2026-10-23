import { VSRepoError } from "../../errors/VSRepoError.js";
import { AdapterMethodOptions } from "../../types/adapter/adapter-method-options.type.js";
import { ClientOrTransaction } from "../../types/utils/client-or-transaction.type.js";
import { Ordering } from "../../types/utils/ordering.type.js";
import { PaginatedResult } from "../../types/utils/paginated-result.type.js";
import { Pagination } from "../../types/utils/pagination.type.js";
import { SeeMode } from "../../types/utils/see-mode.type.js";
import { VSRepoOrmTypes } from "../../types/vsrepo/vsrepo-orm-types.type.js";
import { VSRepoRelations } from "../../types/vsrepo/vsrepo-relations.type.js";
import { VSRepoSelect } from "../../types/vsrepo/vsrepo-select.type.js";
import { VSRepoWhere } from "../../types/vsrepo/vsrepo-where.type.js";
import { VSRepoAdapter } from "../../VSRepoAdapter.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
import { MergeWheresResolver } from "../resolvers/merge-wheres.resolver.js";
import { VSLogger } from "./vs-logger.util.js";

/**
 * Fluent builder for queries whose shape is only known at runtime (optional filters, user-controlled
 * ordering and pagination, ...).
 *
 * Chain the configuration methods (`select`, `relations`, `where`, `orderBy`, `limit`, `offset`,
 * `see`) and run the query with a terminal method (`getResult`, `getOneResult`, `getOneResultOrThrow`,
 * `getCount`, `getExistence` or `getResultAndCount`). Nothing reaches the database until a
 * terminal method is called.
 *
 * The builder is **mutable**: every chained call changes the same instance and returns it. Use
 * `VSQueryBuilder.clone` to derive variations from a common base.
 *
 * Soft-delete is respected the same way as in the repository methods: when the repository has a
 * `softRemoveKey`, only non-deleted records are seen unless `VSQueryBuilder.see` says otherwise.
 *
 * @example
 * ```typescript
 * const result = await userRepository
 *     .createQueryBuilder()
 *     .where({ active: true, balance: { gte: 100 } })
 *     .relations({ address: true })
 *     .orderBy({ createdAt: "desc" })
 *     .limit(20)
 *     .offset(40)
 *     .getResult();
 * ```
 *
 * @publicApi
 */
export class VSQueryBuilder<Entity, OrmTypes extends VSRepoOrmTypes = VSRepoOrmTypes> {
    private options: Omit<AdapterMethodOptions<Entity>, "db" | "pagination"> = {};
    private pagination?: Pagination;
    private seeMode: SeeMode = "active";
    private whereFilter?: VSRepoWhere<Entity>;

    /**
     * @internal
     */
    constructor(
        private db: ClientOrTransaction<OrmTypes>,
        private readonly adapter: VSRepoAdapter<Entity>,
        private readonly mergeWheresResolver: MergeWheresResolver<Entity>,
        private readonly logger: VSLogger,
    ) {}

    private static validateNonNegativeInt(value: number, name: "limit" | "offset"): void {
        if (!Number.isInteger(value) || value < 0) {
            throw new VSRepoError(
                `${name}: Invalid value: Expected >=0 but received ${value}`,
                VSRepoErrorType.QUERY_BUILDER,
            );
        }
    }

    private resolveWhere(): VSRepoWhere<Entity> {
        return this.mergeWheresResolver.resolve(this.seeMode, this.whereFilter);
    }

    private trace(message: string, obj?: unknown): void {
        this.logger.logDebug(`VSQueryBuilder: ${message}`, obj);
    }

    private async execute<R>(operation: string, params: Record<string, unknown>, run: () => Promise<R>): Promise<R> {
        this.trace(operation, { see: this.seeMode, ...params });

        const start = this.logger.startPerformLog(`run query builder ${operation}`);

        try {
            const result = await run();
            this.logger.endPerformLog(start);

            return result;
        } catch (err) {
            this.logger.endPerformLog(start);

            throw err;
        }
    }

    /**
     * Sets the client or transaction the query runs on, replacing the one given to `createQueryBuilder()`.
     *
     * It's lazy — it only matters when a terminal method runs — so a builder can be created before a
     * transaction and pointed at it from inside, or a {@link VSQueryBuilder.clone} can be pointed at another
     * client without touching the original builder.
     *
     * @param db Client or transaction that every following terminal call will use.
     *
     * @example
     * ```typescript
     * const qb = userRepository.createQueryBuilder().where({ active: true });
     *
     * const result = await userRepository.transaction(async tx => {
     *     return qb.setDb(tx).getResult();
     * });
     * ```
     */
    setDb(db: ClientOrTransaction<OrmTypes>): this {
        this.db = db;

        this.trace("db replaced");

        return this;
    }

    /**
     * Runs the query and returns every matching record.
     *
     * Uses everything configured on the builder: filter, `select`, `relations`, `orderBy` and `limit`/`offset`.
     *
     * @returns The matching records (an empty array if none).
     */
    async getResult(): Promise<Entity[]> {
        const where = this.resolveWhere();
        const options = { ...this.options, pagination: this.pagination, db: this.db };

        return this.execute("getResult", { where, options }, () => this.adapter.findMany(where, options));
    }

    /**
     * Runs the query and returns the first matching record, or `null` if there is none.
     *
     * Uses the filter, `select`, `relations`, `orderBy` and `limit`/`offset`.
     *
     * @returns The record, or `null` when nothing matches.
     */
    async getOneResult(): Promise<Entity | null> {
        const where = this.resolveWhere();
        const options = { ...this.options, pagination: this.pagination, db: this.db };

        return this.execute("getOneResult", { where, options }, () => this.adapter.findOne(where, options));
    }

    /**
     * Same as {@link VSQueryBuilder.getOneResult}, but throws instead of returning `null`.
     *
     * The error thrown when nothing matches is the one the adapter's `findOneOrThrow` raises; it is not wrapped.
     *
     * @returns The first matching record.
     */
    async getOneResultOrThrow(): Promise<Entity> {
        const where = this.resolveWhere();
        const options = { ...this.options, pagination: this.pagination, db: this.db };

        return this.execute("getOneResultOrThrow", { where, options }, () =>
            this.adapter.findOneOrThrow(where, options),
        );
    }

    /**
     * Counts the records matching the filter.
     *
     * Forwards `orderBy` and `limit`/`offset` to the adapter's `count` as configured, so if you want the
     * total of a builder that has pagination use {@link VSQueryBuilder.getResultAndCount} or count from a
     * {@link VSQueryBuilder.clone} without it. `select` and `relations` are not used.
     *
     * @returns The number of matching records.
     */
    async getCount(): Promise<number> {
        const where = this.resolveWhere();
        const options = { pagination: this.pagination, db: this.db };

        return this.execute("getCount", { where, options }, () => this.adapter.count(where, options));
    }

    /**
     * Checks whether at least one record matches the filter. Only the filter (and soft-delete visibility) is used.
     *
     * @returns `true` if a matching record exists, `false` otherwise.
     */
    async getExistence(): Promise<boolean> {
        const where = this.resolveWhere();

        return this.execute("getExistence", { where }, () => this.adapter.exists(where, { db: this.db }));
    }

    /**
     * Fetches a page of records and the total of records matching the filter, in a single call
     * (like MikroORM's `getResultAndCount()`).
     *
     * `result` honors `orderBy` and `limit`/`offset`; `count` deliberately ignores `orderBy` and
     * pagination, so it is the total that lets you compute the number of pages. Both queries run in
     * parallel with the same filter and the same `db`.
     *
     * @returns The page (`result`) and the total of matching records (`count`).
     *
     * @example
     * ```typescript
     * const { result, count } = await userRepository
     *     .createQueryBuilder()
     *     .where({ active: true })
     *     .limit(20)
     *     .offset(40)
     *     .getResultAndCount();
     *
     * const totalPages = Math.ceil(count / 20);
     * ```
     */
    async getResultAndCount(): Promise<PaginatedResult<Entity[]>> {
        const where = this.resolveWhere();
        const options = { ...this.options, pagination: this.pagination, db: this.db };

        return this.execute("getResultAndCount", { where, options }, async () => {
            const result = await this.adapter.findMany(where, options);
            const count = await this.adapter.count(where, { db: this.db });

            return { result, count };
        });
    }

    /**
     * Returns an independent builder with the same filter, options, `see` mode and `db`.
     * Changes made to either builder afterwards don't affect the other.
     *
     * @returns The new builder.
     *
     * @example
     * ```typescript
     * const active = userRepository.createQueryBuilder().where({ active: true });
     *
     * const total = await active.clone().getCount();
     * const firstPage = await active.clone().orderBy({ name: "asc" }).limit(10).getResult();
     * ```
     */
    clone(): VSQueryBuilder<Entity, OrmTypes> {
        const qbClone = new VSQueryBuilder<Entity, OrmTypes>(
            this.db,
            this.adapter,
            this.mergeWheresResolver,
            this.logger,
        );

        qbClone.options = { ...this.options };
        qbClone.pagination = { ...this.pagination };
        qbClone.whereFilter = this.whereFilter;
        qbClone.seeMode = this.seeMode;

        this.trace("clone");

        return qbClone;
    }

    /**
     * Sets the fields (and nested relation fields) to select. Replaces any previous `select`.
     *
     * @param select Fields to select, e.g. `{ id: true, name: true, address: { city: true } }`.
     */
    select(select: VSRepoSelect<Entity>): this {
        this.options.select = select;

        return this;
    }

    /**
     * Sets the relations to load together with the records. Replaces any previous `relations`.
     *
     * @param relations Relations to load, e.g. `{ address: true, products: true }`.
     */
    relations(relations: VSRepoRelations<Entity>): this {
        this.options.relations = relations;

        return this;
    }

    /**
     * Sets the filter, replacing any previous one. It accepts the same `VSRepoWhere` used by the rest of
     * the library: field-level filters (`{ active: true, balance: { gte: 100 } }`), relation filters
     * (`_some`/`_every`/`_none`, `_with`/`_without`) and the logical operators `AND`, `OR` and `NOT`.
     *
     * The soft-delete filter (see {@link VSQueryBuilder.see}) is added on top of it when the query runs.
     *
     * @param where Filter of the query.
     *
     * @example
     * ```typescript
     * qb.where({
     *     active: true,
     *     OR: [{ name: { contains: "Maria" } }, { email: { contains: "maria" } }],
     * });
     * ```
     */
    where(where: VSRepoWhere<Entity>): this {
        this.whereFilter = where;

        return this;
    }

    /**
     * Sets the ordering. Replaces any previous ordering.
     *
     * @param order An object, or an array of objects, mapping primitive fields to `"asc"`/`"desc"`
     * (lower or upper case), e.g. `{ createdAt: "desc" }`.
     */
    orderBy(order: Ordering<Entity>): this {
        this.options.order = order;

        return this;
    }

    /**
     * Sets the maximum number of records to return. Can be combined with {@link VSQueryBuilder.offset}.
     *
     * @param limit Non-negative integer.
     */
    limit(limit: number): this {
        VSQueryBuilder.validateNonNegativeInt(limit, "limit");

        this.pagination ??= {};
        this.pagination.limit = limit;

        return this;
    }

    /**
     * Sets how many records to skip. Can be combined with {@link VSQueryBuilder.limit}.
     *
     * @param offset Non-negative integer.
     */
    offset(offset: number): this {
        VSQueryBuilder.validateNonNegativeInt(offset, "offset");

        this.pagination ??= {};
        this.pagination.offset = offset;

        return this;
    }

    /**
     * Sets which records the query sees when the repository has a `softRemoveKey`. Applies to every
     * terminal method (both queries of `getResultAndCount` included) and is ignored by repositories
     * without soft-delete.
     *
     * @param seeMode `"active"` (default) for non-deleted records, `"removed"` for soft-deleted ones
     * or `"all"` to ignore soft-delete.
     */
    see(seeMode: SeeMode): this {
        this.seeMode = seeMode;

        return this;
    }
}

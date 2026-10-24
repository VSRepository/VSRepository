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
 * Chain the configuration methods (`select`, `relations`, `where`, `orderBy`, `limit`, `offset`, `see`)
 * and run it with a terminal method (`getResult`, `getOneResult`, `getOneResultOrThrow`, `getCount`,
 * `getExistence` or `getResultAndCount`). Nothing reaches the database before that.
 *
 * The builder is mutable: every call changes the same instance. Use `clone()` to derive variations.
 * Soft delete is respected as in the repository methods.
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
     * It only matters when a terminal method runs, so a builder can be created first and pointed at a transaction later.
     *
     * @example
     * ```typescript
     * const qb = userRepository.createQueryBuilder().where({ active: true });
     *
     * await userRepository.transaction(async tx => qb.setDb(tx).getResult());
     * ```
     */
    setDb(db: ClientOrTransaction<OrmTypes>): this {
        this.db = db;

        this.trace("db replaced");

        return this;
    }

    /** Returns every matching record. */
    async getResult(): Promise<Entity[]> {
        const where = this.resolveWhere();
        const options = { ...this.options, pagination: this.pagination };

        return this.execute("getResult", { where, options }, () =>
            this.adapter.findMany(where, { ...options, db: this.db }),
        );
    }

    /** Returns the first matching record, or `null` if there is none. */
    async getOneResult(): Promise<Entity | null> {
        const where = this.resolveWhere();
        const options = { ...this.options, pagination: this.pagination };

        return this.execute("getOneResult", { where, options }, () =>
            this.adapter.findOne(where, { ...options, db: this.db }),
        );
    }

    /** Returns the first matching record or throws an error when nothing matches. */
    async getOneResultOrThrow(): Promise<Entity> {
        const where = this.resolveWhere();
        const options = { ...this.options, pagination: this.pagination };

        return this.execute("getOneResultOrThrow", { where, options }, () =>
            this.adapter.findOneOrThrow(where, { ...options, db: this.db }),
        );
    }

    /**
     * Counts the records matching the filter.
     */
    async getCount(): Promise<number> {
        const where = this.resolveWhere();

        return this.execute("getCount", { where }, () => this.adapter.count(where, { db: this.db }));
    }

    /** Checks whether at least one record matches the filter. */
    async getExistence(): Promise<boolean> {
        const where = this.resolveWhere();

        return this.execute("getExistence", { where }, () => this.adapter.exists(where, { db: this.db }));
    }

    /**
     * Fetches a page of records plus the total of records matching the filter.
     * `result` honors `orderBy` and `limit`/`offset`; `count` ignores them, so it's the total
     * you need to compute the number of pages.
     *
     * @example
     * ```typescript
     * const { result, count } = await userRepository
     *     .createQueryBuilder()
     *     .where({ active: true })
     *     .limit(20)
     *     .offset(40)
     *     .getResultAndCount();
     * ```
     */
    async getResultAndCount(): Promise<PaginatedResult<Entity[]>> {
        const where = this.resolveWhere();
        const options = { ...this.options, pagination: this.pagination };

        return this.execute("getResultAndCount", { where, options }, async () => {
            const result = await this.adapter.findMany(where, { ...options, db: this.db });
            const count = await this.adapter.count(where, { db: this.db });

            return { result, count };
        });
    }

    /**
     * Returns an independent builder with the same filter, options, `see` mode and `db`.
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
     * Sets the fields to select, replacing any previous `select`.
     */
    select(select: VSRepoSelect<Entity>): this {
        this.options.select = select;

        return this;
    }

    /**
     * Sets the relations to load, replacing any previous `relations`.
     */
    relations(relations: VSRepoRelations<Entity>): this {
        this.options.relations = relations;

        return this;
    }

    /**
     * Sets the filter, replacing any previous one. Accepts the same `VSRepoWhere` as the repository methods.
     * Soft-delete visibility (`see`) is applied on top of it.
     */
    where(where: VSRepoWhere<Entity>): this {
        this.whereFilter = where;

        return this;
    }

    /**
     * Sets the ordering, replacing any previous one.
     */
    orderBy(order: Ordering<Entity>): this {
        this.options.order = order;

        return this;
    }

    /**
     * Sets the maximum number of records to return.
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
     * Sets how many records to skip.
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
     * Sets which records the query sees when the repository has soft delete enabled. Applies to every
     * terminal method and defaults to `"active"`.
     */
    see(seeMode: SeeMode): this {
        this.seeMode = seeMode;

        return this;
    }
}

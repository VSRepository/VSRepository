import { VSRepoError } from "../../errors/VSRepoError.js";
import { AdapterMethodOptions } from "../../types/adapter/adapter-method-options.type.js";
import { KeysOfType } from "../../types/utils/keys-of-type.type.js";
import { Ordering } from "../../types/utils/ordering.type.js";
import { Primitive } from "../../types/utils/primitive.type.js";
import { SeeMode } from "../../types/utils/see-mode.type.js";
import { VSRepoOrmTypes } from "../../types/vsrepo/vsrepo-orm-types.type.js";
import { VSRepoRelations } from "../../types/vsrepo/vsrepo-relations.type.js";
import { VSRepoSelect } from "../../types/vsrepo/vsrepo-select.type.js";
import { VSRepoWhere } from "../../types/vsrepo/vsrepo-where.type.js";
import { VSRepoAdapter } from "../../VSRepoAdapter.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
import { MergeWheresResolver } from "../resolvers/merge-wheres.resolver.js";
import orderingSchema from "../validators/schemas/ordering.schema.js";
import relationsSchema from "../validators/schemas/relations.schema.js";
import seeModeSchema from "../validators/schemas/see-mode.schema.js";
import selectSchema from "../validators/schemas/select.schema.js";
import whereSchema from "../validators/schemas/where.schema.js";
import { VSLogger } from "./vs-logger.util.js";
import * as v from "valibot";

/**
 * Fluent builder for queries whose shape is only known at runtime (optional filters, user-controlled
 * ordering and pagination, ...). Get one from `VSRepository.createQueryBuilder()`.
 *
 * Chain the configuration methods (`select`, `relations`, `where`, `orderBy`, `limit`, `offset`,
 * `distinctOn`, `see`) and run the query with a terminal method (`getResult`,
 * `getOneResult`, `getOneResultOrThrow`, `getCount`, `getExistence` or `getResultAndCount`). Nothing
 * reaches the database until a terminal method is called.
 *
 * The builder is **mutable**: every chained call changes the same instance and returns it. Use
 * {@link VSQueryBuilder.clone} to derive variations from a common base.
 *
 * Soft-delete is respected the same way as in the repository methods: when the repository has a
 * `softRemoveKey`, only non-deleted records are seen unless {@link VSQueryBuilder.see} says otherwise.
 *
 * Arguments are validated as soon as they are passed to a chained method; an invalid one throws a
 * `VSRepoError` of type `QUERY_BUILDER` and leaves the builder unchanged.
 *
 * @template Entity Type of the entity being queried.
 * @template OrmTypes ORM-specific client/transaction types. See `VSRepoOrmTypes`.
 *
 * @example
 * ```typescript
 * const { result, count } = await userRepository
 *     .createQueryBuilder()
 *     .where({ active: true, balance: { gte: 100 } })
 *     .relations({ address: true })
 *     .orderBy({ createdAt: "desc" })
 *     .limit(20)
 *     .offset(40)
 *     .getResultAndCount();
 * ```
 *
 * @publicApi
 */
export class VSQueryBuilder<Entity, OrmTypes extends VSRepoOrmTypes = VSRepoOrmTypes> {
    private options: Omit<AdapterMethodOptions<Entity>, "db"> = {};
    private distinct?: KeysOfType<Entity, Primitive>[];
    private seeMode: SeeMode = "active";
    private whereFilter?: VSRepoWhere<Entity>;

    /**
     * @internal
     */
    constructor(
        private db: OrmTypes["dbClient"] | OrmTypes["dbTransaction"],
        private readonly adapter: VSRepoAdapter<Entity>,
        private readonly mergeWheresResolver: MergeWheresResolver<Entity>,
        private readonly logger?: VSLogger,
    ) {}

    private failValidation(issue: v.GenericIssue | undefined, fallbackPath = "options"): never {
        const path = issue?.path?.length ? issue.path.map(p => String(p.key)).join(".") : fallbackPath;
        const message = `${path}: ${issue?.message ?? "validation failed"}`;

        this.logger?.logError(`Validation failed (${VSRepoErrorType.QUERY_BUILDER}): ${message}`);

        throw new VSRepoError(message, VSRepoErrorType.QUERY_BUILDER);
    }

    private validate(value: unknown, schema: v.GenericSchema, fallbackPath?: string): void {
        const parsed = v.safeParse(schema, value);

        if (!parsed.success) {
            this.failValidation(parsed.issues[0], fallbackPath);
        }
    }

    private resolveWhere(): VSRepoWhere<Entity> {
        return this.mergeWheresResolver.resolve(this.seeMode, this.whereFilter ?? {});
    }

    // * Log de debug dos passos do builder e das queries. O objeto só é serializado se o nível for DEBUG
    private trace(message: string, obj?: unknown): void {
        this.logger?.logDebug(`VSQueryBuilder: ${message}`, obj);
    }

    // * Nunca logar o `db` aqui (client/transação do ORM), só os parâmetros da query
    private async execute<R>(operation: string, params: Record<string, unknown>, run: () => Promise<R>): Promise<R> {
        this.trace(operation, { see: this.seeMode, ...params });

        const start = this.logger?.startPerformLog(`run query builder ${operation}`);

        try {
            return await run();
        } finally {
            this.logger?.endPerformLog(start);
        }
    }

    private setOptions(options: Omit<AdapterMethodOptions<Entity>, "db">): void {
        this.options = options;
    }

    private setWhereFilter(whereFilter?: VSRepoWhere<Entity>): void {
        this.whereFilter = whereFilter;
    }

    private setDistinct(distinct?: KeysOfType<Entity, Primitive>[]): void {
        this.distinct = distinct;
    }

    private setSeeMode(seeMode: SeeMode): void {
        this.seeMode = seeMode;
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
     * await userRepository.transaction(async tx => {
     *     qb.setDb(tx);
     *     return qb.getResult();
     * });
     * ```
     */
    setDb(db: OrmTypes["dbClient"] | OrmTypes["dbTransaction"]): void {
        this.db = db;

        this.trace("db replaced");
    }

    /**
     * Runs the query and returns every matching record.
     *
     * Uses everything configured on the builder: filter, `select`, `relations`, `orderBy`, `limit`/`offset`
     * and `distinctOn` (the only terminal method that applies `distinct`).
     *
     * @returns The matching records (an empty array if none).
     */
    async getResult(): Promise<Entity[]> {
        const where = this.resolveWhere();
        const options = { ...this.options, distinct: this.distinct };

        return this.execute("getResult", { where, options }, () =>
            this.adapter.findMany(where, { ...options, db: this.db }),
        );
    }

    /**
     * Runs the query and returns the first matching record, or `null` if there is none.
     *
     * Uses the filter, `select`, `relations`, `orderBy` and `limit`/`offset`. `distinctOn` is not applied.
     *
     * @returns The record, or `null` when nothing matches.
     */
    async getOneResult(): Promise<Entity | null> {
        const where = this.resolveWhere();
        const options = { ...this.options };

        return this.execute("getOneResult", { where, options }, () =>
            this.adapter.findOne(where, { ...options, db: this.db }),
        );
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
        const options = { ...this.options };

        return this.execute("getOneResultOrThrow", { where, options }, () =>
            this.adapter.findOneOrThrow(where, { ...options, db: this.db }),
        );
    }

    /**
     * Counts the records matching the filter.
     *
     * Forwards `orderBy` and `limit`/`offset` to the adapter's `count` as configured, so if you want the
     * total of a builder that has pagination use {@link VSQueryBuilder.getResultAndCount} or count from a
     * {@link VSQueryBuilder.clone} without it. `select`, `relations` and `distinctOn` are not used
     * (`count` doesn't support `distinct`).
     *
     * @returns The number of matching records.
     */
    async getCount(): Promise<number> {
        const where = this.resolveWhere();
        const options = { order: this.options.order, pagination: this.options.pagination };

        return this.execute("getCount", { where, options }, () =>
            this.adapter.count(where, { ...options, db: this.db }),
        );
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
     * parallel with the same filter and the same `db`. `distinctOn` is not used by either.
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
    async getResultAndCount(): Promise<{ result: Entity[]; count: number }> {
        const where = this.resolveWhere();
        const options = { ...this.options };

        return this.execute("getResultAndCount", { where, options }, async () => {
            const [result, count] = await Promise.all([
                this.adapter.findMany(where, { ...options, db: this.db }),
                this.adapter.count(where, { db: this.db }),
            ]);

            return { result, count };
        });
    }

    /**
     * Returns an independent builder with the same filter, options, `distinctOn` fields, `see` mode and `db`.
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

        qbClone.setOptions(structuredClone(this.options));
        qbClone.setWhereFilter(this.whereFilter);
        qbClone.setDistinct(this.distinct);
        qbClone.setSeeMode(this.seeMode);

        this.trace("clone");

        return qbClone;
    }

    /**
     * Sets the fields (and nested relation fields) to select. Replaces any previous `select`.
     *
     * @param select Fields to select, e.g. `{ id: true, name: true, address: { city: true } }`.
     * @throws {VSRepoError} `QUERY_BUILDER` if `select` doesn't have a valid shape.
     */
    select(select: VSRepoSelect<Entity>): this {
        this.validate(select, selectSchema, "select");

        this.options.select = select;

        this.trace("select", select);

        return this;
    }

    /**
     * Sets the relations to load together with the records. Replaces any previous `relations`.
     *
     * @param relations Relations to load, e.g. `{ address: true, products: true }`.
     * @throws {VSRepoError} `QUERY_BUILDER` if `relations` doesn't have a valid shape.
     */
    relations(relations: VSRepoRelations<Entity>): this {
        this.validate(relations, relationsSchema, "relations");

        this.options.relations = relations;

        this.trace("relations", relations);

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
     * @throws {VSRepoError} `QUERY_BUILDER` if `where` doesn't have a valid shape.
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
        this.validate(where, whereSchema, "where");

        this.whereFilter = where;

        this.trace("where", where);

        return this;
    }

    /**
     * Sets the ordering. Replaces any previous ordering.
     *
     * @param order An object, or an array of objects, mapping primitive fields to `"asc"`/`"desc"`
     * (lower or upper case), e.g. `{ createdAt: "desc" }`.
     * @throws {VSRepoError} `QUERY_BUILDER` if `order` doesn't have a valid shape.
     */
    orderBy(order: Ordering<Entity>): this {
        this.validate(order, orderingSchema, "order");

        this.options.order = order;

        this.trace("orderBy", order);

        return this;
    }

    /**
     * Sets the maximum number of records to return. Can be combined with {@link VSQueryBuilder.offset}.
     *
     * @param limit Non-negative integer.
     * @throws {VSRepoError} `QUERY_BUILDER` if `limit` isn't a non-negative integer.
     */
    limit(limit: number): this {
        this.validate(limit, v.pipe(v.number(), v.integer(), v.minValue(0)), "limit");

        this.options.pagination ??= {};
        this.options.pagination.limit = limit;

        this.trace(`limit ${limit}`);

        return this;
    }

    /**
     * Sets how many records to skip. Can be combined with {@link VSQueryBuilder.limit}.
     *
     * @param offset Non-negative integer.
     * @throws {VSRepoError} `QUERY_BUILDER` if `offset` isn't a non-negative integer.
     */
    offset(offset: number): this {
        this.validate(offset, v.pipe(v.number(), v.integer(), v.minValue(0)), "offset");

        this.options.pagination ??= {};
        this.options.pagination.offset = offset;

        this.trace(`offset ${offset}`);

        return this;
    }

    /**
     * Sets the field(s) to apply `distinct` on. Replaces any previous `distinctOn`.
     *
     * Only {@link VSQueryBuilder.getResult} uses it: the ecosystem's `count` doesn't support `distinct`.
     *
     * @param fields A primitive field, or an array of them.
     * @throws {VSRepoError} `QUERY_BUILDER` if `fields` isn't a string or an array of strings.
     */
    distinctOn(fields: KeysOfType<Entity, Primitive> | KeysOfType<Entity, Primitive>[]): this {
        this.validate(fields, v.union([v.string(), v.array(v.string())]), "fields");

        this.distinct = Array.isArray(fields) ? fields : [fields];

        this.trace("distinctOn", this.distinct);

        return this;
    }

    /**
     * Sets which records the query sees when the repository has a `softRemoveKey`. Applies to every
     * terminal method (both queries of `getResultAndCount` included) and is ignored by repositories
     * without soft-delete.
     *
     * @param seeMode `"active"` (default) for non-deleted records, `"removed"` for soft-deleted ones
     * or `"all"` to ignore soft-delete.
     * @throws {VSRepoError} `QUERY_BUILDER` if `seeMode` isn't one of the modes above.
     */
    see(seeMode: SeeMode): this {
        this.validate(seeMode, seeModeSchema, "seeMode");

        this.seeMode = seeMode;

        this.trace(`see '${seeMode}'`);

        return this;
    }
}

import { VSRepoOptions } from "./types/vsrepo/vsrepo-options.type.js";
import { CountResult } from "./types/utils/count-result.type.js";
import { DeepPartial } from "./types/utils/deep-partial.type.js";
import { KeysOfType } from "./types/utils/keys-of-type.type.js";
import { VSRepoAdapter } from "./VSRepoAdapter.js";
import { VSRepoWhere } from "./types/vsrepo/vsrepo-where.type.js";
import { MergeWheresResolver } from "./internal/resolvers/merge-wheres.resolver.js";
import { VSRepoOrmTypes } from "./types/vsrepo/vsrepo-orm-types.type.js";
import { VSRepoTransactionOptions } from "./types/vsrepo/vsrepo-transaction-options.type.js";
import { MethodOptions } from "./types/utils/methods-options.type.js";
import { Ordering } from "./types/utils/ordering.type.js";
import { VSLogger } from "./internal/utils/vs-logger.util.js";
import { VSLogLevel } from "./internal/enums/vs-log-level.enum.js";
import { VSRepoArgs } from "./types/vsrepo/vsrepo-args.type.js";
import { DynamicMethodsResolver } from "./internal/resolvers/dynamic-methods.resolver.js";
import { VSRepoError } from "./errors/VSRepoError.js";
import { VSRepoErrorType } from "./internal/enums/vsrepo-error-type.enum.js";
import { VSRepoQueryOptions } from "./types/vsrepo/vsrepo-query-options.type.js";
import { NumericKeys } from "./types/utils/numeric-keys.type.js";
import { RestrictMethodOptions } from "./types/utils/restrict-method-options.type.js";
import { VSQueryBuilder } from "./internal/utils/vs-query-builder.util.js";
import { VSRawQueryBuilder } from "./internal/utils/vs-raw-query-builder.util.js";
import { VSSql } from "./internal/utils/vs-sql.util.js";
import { VSPlaceholdersParser } from "./internal/utils/vs-placeholder-parser.util.js";
import { ResolvedMethodsResult } from "./types/utils/resolved-methods-result.type.js";
import { ClientOrTransaction } from "./types/utils/client-or-transaction.type.js";
import { SoftDeleteMetadata } from "./types/decorators/soft-delete-metadata.type.js";
import { ENABLE_SOFT_DELETE_KEY } from "./internal/constants/enable-soft-delete-key.constant.js";
import { VSRepoGlobalConfig } from "./types/vsrepo/vsrepo-global-config.type.js";
import { SimpleMethodOptions } from "./types/utils/simple-methods-options.type.js";
import { WithIgnoreConflicts } from "./types/utils/with-ignore-conflicts.type.js";
import { PaginatedResult } from "./types/utils/paginated-result.type.js";

/**
 * ORM-agnostic base repository. Extend it and provide an adapter to get the base methods
 * (`find`, `save`, `update`, ...), dynamic methods and query methods.
 *
 * @template Entity Entity managed by the repository.
 * @template PKType Type of the entity's primary key.
 * @template OrmTypes ORM-specific client/transaction types.
 *
 * @example
 * ```typescript
 * class UserRepository extends VSRepository<User, string> {
 *     constructor() {
 *         super({ pkName: "id", adapter: new SomeOrmAdapter(...) });
 *     }
 *
 *     *@DynamicMethod()
 *     declare findByEmail: (email: string) => Promise<User[]>;
 * }
 * ```
 *
 * @publicApi
 */
export abstract class VSRepository<Entity, PKType, OrmTypes extends VSRepoOrmTypes = VSRepoOrmTypes> {
    private readonly pkName: KeysOfType<Entity, PKType>;

    private readonly adapter: VSRepoAdapter<Entity>;
    private readonly mergeWheresResolver: MergeWheresResolver<Entity>;
    private readonly logger: VSLogger;

    private softDeleteField?: string;
    private readonly defaultOrdering?: Ordering<Entity>;
    private readonly vsPlaceholders: boolean;

    private dynamicMethodsResolved = false;
    private alreadyWarnedResolveDynamicMethods = false;

    private static globalConfig: VSRepoGlobalConfig = {};

    /**
     * This is a property managed by VSRepository, please don't modify it!!
     * @internal
     */
    _vsrepocache: Map<string, (args: any[], methodOptions?: MethodOptions<Entity, OrmTypes>) => VSRepoArgs<Entity>> =
        new Map();

    /**
     * Creates the repository and, unless `lazyDynamicMethods` is `true`, resolves its
     * `@DynamicMethod`/`@QueryMethod` fields.
     */
    constructor(options: VSRepoOptions<Entity, PKType>) {
        this.adapter = options.adapter;

        if (options.pkName) {
            this.pkName = options.pkName;
        } else if (this.adapter.getPkName) {
            this.pkName = this.adapter.getPkName() as KeysOfType<Entity, PKType>;
        } else {
            throw new VSRepoError(
                "Your adapter did not implement the 'getPkName' method; try updating your adapter to a newer version or manually configure 'pkName' in the constructor's 'options'.",
                VSRepoErrorType.BASE,
            );
        }

        this.defaultOrdering = options.defaultOrdering;
        this.vsPlaceholders = options.vsPlaceholders ?? VSRepository.globalConfig.vsPlaceholders ?? true;

        this.resolveSoftDelete();

        this.mergeWheresResolver = new MergeWheresResolver<Entity>(this.softDeleteField);
        this.logger = new VSLogger(
            options.logLevel ?? VSRepository.globalConfig.logLevel ?? VSLogLevel.WARN,
            this.constructor.name + "Logger",
        );

        this.logger.logInfo(
            `Initializing ${this.constructor.name} (pk: '${String(this.pkName)}'` +
                (this.softDeleteField ? `, softDeleteField: '${String(this.softDeleteField)}'` : "") +
                (this.defaultOrdering ? `, defaultOrdering: ${JSON.stringify(this.defaultOrdering)}` : "") +
                `, adapter: ${this.adapter.constructor.name}` +
                `)`,
        );

        let dynamicMethodsCount: number | undefined;
        let queryMethodsCount: number | undefined;

        options.lazyDynamicMethods ??= VSRepository.globalConfig.lazyDynamicMethods;

        if (!options.lazyDynamicMethods) {
            const result = this.resolveDynamicMethods();
            dynamicMethodsCount = result.dynamicMethodsCount;
            queryMethodsCount = result.queryMethodsCount;
        }

        this.logger.logInfo(
            `${this.constructor.name} ready (${options.lazyDynamicMethods ? "Resolution of dynamic methods postponed" : `${dynamicMethodsCount} dynamic method(s), ${queryMethodsCount} query method(s) resolved`})`,
        );
    }

    private resolveSoftDelete() {
        const softDeleteMetadata: SoftDeleteMetadata | undefined = Reflect.getMetadata(
            ENABLE_SOFT_DELETE_KEY,
            this.constructor,
        );

        if (softDeleteMetadata?.active) {
            this.softDeleteField = softDeleteMetadata.field ?? VSRepository.globalConfig.softDeleteField;

            if (!this.softDeleteField) {
                throw new VSRepoError(
                    "A field for soft delete must be specified, configure it via the decorator or set it globally.",
                    VSRepoErrorType.BASE,
                );
            }
        }
    }

    /**
     * Resolves every `@DynamicMethod`/`@QueryMethod` field declared on the subclass.
     *
     * Runs automatically in the constructor; when `lazyDynamicMethods: true` is set, the subclass
     * must call it itself. Calling it again re-resolves everything and logs a `WARN`.
     *
     * @returns How many dynamic and query methods were resolved.
     */
    protected resolveDynamicMethods(): ResolvedMethodsResult {
        if (this.dynamicMethodsResolved && !this.alreadyWarnedResolveDynamicMethods) {
            this.logger.logWarn(
                `resolveDynamicMethods() was called more than once on ${this.constructor.name}. ` +
                    `If you are calling it manually, make sure lazyDynamicMethods is set to true ` +
                    `in the constructor options to skip the automatic resolution.`,
            );

            this.alreadyWarnedResolveDynamicMethods = true;
        }

        const dynamicMethodsResolver = new DynamicMethodsResolver<Entity, PKType>(
            this.logger,
            this.adapter,
            this.mergeWheresResolver,
            this.defaultOrdering,
            this.vsPlaceholders,
        );

        let dynamicMethodsCount = 0;
        let queryMethodsCount = 0;

        try {
            const start = this.logger.startPerformLog("resolve dynamic methods");
            dynamicMethodsCount = dynamicMethodsResolver.resolve(this);
            this.logger.endPerformLog(start);

            const startQuery = this.logger.startPerformLog("resolve query methods");
            queryMethodsCount = dynamicMethodsResolver.resolveQueries(this);
            this.logger.endPerformLog(startQuery);
        } catch (err) {
            this.logger.logError(`Failed to initialize ${this.constructor.name}`, err);
            throw err;
        }

        this.dynamicMethodsResolved = true;

        return { dynamicMethodsCount, queryMethodsCount };
    }

    private fail(message: string, type: VSRepoErrorType): never {
        this.logger.logError(`${this.constructor.name}: ${message}`);
        throw new VSRepoError(message, type);
    }

    private wherePk(pk: PKType): VSRepoWhere<Entity> {
        return { [this.pkName]: pk } as VSRepoWhere<Entity>;
    }

    private async execBaseMethod<R>(
        fn: (options: MethodOptions<Entity, OrmTypes>) => Promise<R>,
        methodName: string,
        options: MethodOptions<Entity, OrmTypes> = {},
    ): Promise<R> {
        const resolvedOptions = { ...options };
        resolvedOptions.db ??= this.getDbClient();

        const start = this.logger.startPerformLog("run " + methodName);

        try {
            const result = await fn(resolvedOptions);
            this.logger.endPerformLog(start);

            return result;
        } catch (err) {
            this.logger.endPerformLog(start);
            // this.logger.logError(`Failed to run '${methodName}' on ${this.constructor.name}`, err);

            throw err;
        }
    }

    /**
     * Runs `fn` inside a native transaction of the underlying ORM. Pass `tx` as the `db` option of
     * every call that must take part in it. Errors thrown by `fn` propagate unchanged.
     *
     * @param fn Callback that receives the transaction client. Its result is returned.
     * @param options Isolation level and timeout.
     *
     * @example
     * ```typescript
     * await userRepository.transaction(async tx => {
     *     const user = await userRepository.create({ name: "Maria" }, { db: tx });
     *     await logRepository.create({ userId: user.id }, { db: tx });
     * });
     * ```
     */
    async transaction<R, TX = OrmTypes["dbTransaction"]>(
        fn: (tx: TX) => Promise<R>,
        options?: VSRepoTransactionOptions,
    ): Promise<R> {
        if (typeof fn !== "function") {
            this.fail("'fn' must be a valid function", VSRepoErrorType.BASE);
        }

        return this.adapter.runInTransaction(fn, options);
    }

    /** Returns the underlying ORM client instance used outside of transactions. */
    getDbClient<DB extends any = OrmTypes["dbClient"]>(): DB {
        return this.adapter.getDbClient();
    }

    /** Returns the adapter this repository delegates to, optionally typed as a specific adapter class. */
    getAdapter<A extends VSRepoAdapter<Entity> = VSRepoAdapter<Entity>>(): A {
        return this.adapter as A;
    }

    /** Static form of `createQueryBuilder()` for the given repository. */
    static getQueryBuilder<E, O extends VSRepoOrmTypes>(
        repository: VSRepository<E, any, O>,
        db?: ClientOrTransaction<O>,
    ): VSQueryBuilder<E, O> {
        return repository.createQueryBuilder(db);
    }

    /** Static form of `createRawQueryBuilder()` for the given repository. */
    static getRawQueryBuilder<O extends VSRepoOrmTypes>(
        repository: VSRepository<any, any, O>,
        db?: ClientOrTransaction<O>,
    ): VSRawQueryBuilder<O> {
        return repository.createRawQueryBuilder(db);
    }

    /**
     * Replaces the defaults shared by every repository. Per-repository options take precedence.
     * Only repositories created after the call are affected.
     */
    static setGlobalConfig(globalConfig: VSRepoGlobalConfig): void {
        this.globalConfig = globalConfig;
    }

    /**
     * Creates a `VSQueryBuilder` for queries whose shape is only known at runtime. Nothing runs
     * until a terminal method (`getResult`, `getCount`, ...) is called.
     *
     * @param db Client or transaction to run on. Defaults to the repository's client.
     *
     * @example
     * ```typescript
     * const users = await userRepository
     *     .createQueryBuilder()
     *     .where({ active: true })
     *     .orderBy({ createdAt: "desc" })
     *     .limit(10)
     *     .getResult();
     * ```
     */
    createQueryBuilder(db?: ClientOrTransaction<OrmTypes>): VSQueryBuilder<Entity, OrmTypes> {
        return new VSQueryBuilder(
            db ?? this.adapter.getDbClient(),
            this.adapter,
            this.mergeWheresResolver,
            this.logger,
        );
    }

    /**
     * Creates a `VSRawQueryBuilder` for hand-written `SELECT` queries that are too specific for
     * `createQueryBuilder()` (window functions, CTEs, vendor-specific syntax, ...).
     *
     * @param db Client or transaction to run on. Defaults to the repository's client.
     *
     * @example
     * ```typescript
     * const rows = await userRepository
     *     .createRawQueryBuilder()
     *     .select("id", "name")
     *     .from("user")
     *     .where(VSSql.sql`active = ${true}`)
     *     .limit(20)
     *     .execute<User[]>();
     * ```
     */
    createRawQueryBuilder(db?: ClientOrTransaction<OrmTypes>): VSRawQueryBuilder<OrmTypes> {
        return new VSRawQueryBuilder<OrmTypes>(db ?? this.adapter.getDbClient(), this.adapter, this.logger);
    }

    /**
     * Runs a raw SQL query, given as a string or as a `VSSql` fragment. Strings use `?1`, `?2`, ...
     * placeholders unless `vsPlaceholders` is `false`.
     *
     * Set `options.modifying` for `INSERT`/`UPDATE`/`DELETE` statements and `options.singleResult`
     * to get the first row (or `null`) instead of an array.
     *
     * @example
     * ```typescript
     * const users = await userRepository.query<User[]>(
     *     'SELECT * FROM "user" WHERE email = ?1',
     *     { args: ["joao@email.com"] },
     * );
     * ```
     */
    async query<T = any>(query: string, options?: VSRepoQueryOptions<OrmTypes>): Promise<T>;
    /** Runs a `VSSql` fragment. Parameters come from the fragment itself, so `options.args` isn't accepted. */
    async query<T = any>(sql: VSSql, options?: Omit<VSRepoQueryOptions<OrmTypes>, "args">): Promise<T>;
    async query<T = any>(queryOrSql: string | VSSql, options?: VSRepoQueryOptions<OrmTypes>): Promise<T> {
        let query: string;
        let args: any[] | undefined = options?.args;

        const sqlFragment: VSSql | undefined =
            queryOrSql instanceof VSSql
                ? queryOrSql
                : this.vsPlaceholders
                  ? VSPlaceholdersParser.parse(queryOrSql, args)
                  : undefined;

        if (sqlFragment) {
            const compiled = sqlFragment.compile(index => this.adapter.getPlaceholder(index));
            query = compiled.query;
            args = compiled.args;
        } else if (typeof queryOrSql === "string") {
            query = queryOrSql;
        } else {
            this.fail("'query' must be a valid string or a 'VSSql' fragment", VSRepoErrorType.BASE);
        }

        const queryOptions = { ...options, args };
        queryOptions.db ??= this.getDbClient();

        this.logger.logDebug(`${this.constructor.name} query:`, {
            query,
            args: queryOptions.args ?? [],
            modifying: queryOptions.modifying ?? false,
            singleResult: queryOptions.singleResult ?? false,
        });

        const start = this.logger.startPerformLog("run query");

        try {
            const result = await this.adapter.query<T>(query, {
                args: queryOptions.args,
                db: queryOptions.db,
                modifying: queryOptions.modifying ?? false,
            });

            const resolved = queryOptions.singleResult && Array.isArray(result) ? (result[0] ?? null) : result;

            this.logger.endPerformLog(start);

            return resolved;
        } catch (err) {
            this.logger.endPerformLog(start);
            // this.logger.logError(`Failed to run 'query' on ${this.constructor.name}`, err);

            throw err;
        }
    }

    private resolveDefaultOrdering(options: MethodOptions<Entity, OrmTypes>): MethodOptions<Entity, OrmTypes> {
        return {
            ...options,
            order: options.order ?? this.defaultOrdering,
        };
    }

    /** Returns every record matching `where` (all records if omitted). Applies `defaultOrdering` unless `options.order` is set. */
    async find(where?: VSRepoWhere<Entity>, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity[]> {
        return this.execBaseMethod(
            opt =>
                this.adapter.findMany(
                    this.mergeWheresResolver.resolve(opt.see, where),
                    this.resolveDefaultOrdering(opt),
                ),
            "find",
            options,
        );
    }

    /**
     * Returns the records matching `where` along with their total count.
     */
    async findAndCount(
        where?: VSRepoWhere<Entity>,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<PaginatedResult<Entity[]>> {
        return this.execBaseMethod(
            async opt => {
                const whereResolved = this.mergeWheresResolver.resolve(opt.see, where);

                const result = await this.adapter.findMany(whereResolved, this.resolveDefaultOrdering(opt));
                const count = await this.adapter.count(whereResolved, { db: opt.db });

                return { result, count };
            },
            "findAndCount",
            options,
        );
    }

    /** Returns the first record matching `where`, or `null` if there is none. */
    async findOne(where?: VSRepoWhere<Entity>, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity | null> {
        return this.execBaseMethod(
            opt =>
                this.adapter.findOne(
                    this.mergeWheresResolver.resolve(opt.see, where),
                    this.resolveDefaultOrdering(opt),
                ),
            "findOne",
            options,
        );
    }

    /** Same as `findOne`, but throws (error raised by the adapter) when nothing matches. */
    async findOneOrThrow(where?: VSRepoWhere<Entity>, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        return this.execBaseMethod(
            opt =>
                this.adapter.findOneOrThrow(
                    this.mergeWheresResolver.resolve(opt.see, where),
                    this.resolveDefaultOrdering(opt),
                ),
            "findOneOrThrow",
            options,
        );
    }

    /** Returns the record with the given primary key, or `null` if there is none. */
    async get(id: PKType, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity | null> {
        return this.execBaseMethod(
            opt =>
                this.adapter.findOne(
                    this.mergeWheresResolver.resolve(opt.see, this.wherePk(id)),
                    this.resolveDefaultOrdering(opt),
                ),
            "get",
            options,
        );
    }

    /** Same as `get`, but throws (error raised by the adapter) when nothing matches. */
    async getOrThrow(id: PKType, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        return this.execBaseMethod(
            opt =>
                this.adapter.findOneOrThrow(
                    this.mergeWheresResolver.resolve(opt.see, this.wherePk(id)),
                    this.resolveDefaultOrdering(opt),
                ),
            "getOrThrow",
            options,
        );
    }

    /** Creates or updates (upsert) a record. */
    async save(obj: DeepPartial<Entity>, options?: SimpleMethodOptions<Entity, OrmTypes>): Promise<Entity>;
    /** Creates or updates (upsert) a list of records. */
    async save(obj: DeepPartial<Entity>[], options?: SimpleMethodOptions<Entity, OrmTypes>): Promise<Entity[]>;
    async save(
        obj: DeepPartial<Entity> | DeepPartial<Entity>[],
        options?: SimpleMethodOptions<Entity, OrmTypes>,
    ): Promise<Entity | Entity[]> {
        return this.execBaseMethod<Entity | Entity[]>(
            opt =>
                Array.isArray(obj)
                    ? this.adapter.saveMany(obj as DeepPartial<Entity>[], opt)
                    : this.adapter.save(obj, opt),
            "save",
            options,
        );
    }

    /** Creates a record and returns it. */
    async create(obj: DeepPartial<Entity>, options?: SimpleMethodOptions<Entity, OrmTypes>): Promise<Entity> {
        return this.execBaseMethod(opt => this.adapter.create(obj, opt), "create", options);
    }

    /** Creates several records at once and returns how many were created. With `ignoreConflicts`, rows that violate a unique constraint are skipped. */
    async createMany(
        objs: DeepPartial<Entity>[],
        options?: WithIgnoreConflicts<RestrictMethodOptions<Entity, OrmTypes>>,
    ): Promise<CountResult> {
        return this.execBaseMethod(opt => this.adapter.createMany(objs, opt), "createMany", options);
    }

    /** Same as `createMany`, but returns the created records. */
    async createManyReturning(
        objs: DeepPartial<Entity>[],
        options?: WithIgnoreConflicts<SimpleMethodOptions<Entity, OrmTypes>>,
    ): Promise<Entity[]> {
        return this.execBaseMethod(opt => this.adapter.createManyReturning(objs, opt), "createManyReturning", options);
    }

    /** Permanently deletes the record matching `where` and returns it. */
    async delete(where: VSRepoWhere<Entity>, options?: SimpleMethodOptions<Entity, OrmTypes>): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.delete(this.mergeWheresResolver.resolve(opt.see, where), opt),
            "delete",
            options,
        );
    }

    /** Permanently deletes the record matching the primary key. */
    async remove(id: PKType, options?: SimpleMethodOptions<Entity, OrmTypes>): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.delete(this.mergeWheresResolver.resolve(opt.see, this.wherePk(id)), opt),
            "remove",
            options,
        );
    }

    /** Permanently deletes every record matching `where` and returns how many were deleted. */
    async deleteMany(
        where: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<CountResult> {
        return this.execBaseMethod(
            opt => this.adapter.deleteMany(this.mergeWheresResolver.resolve(opt.see, where), opt),
            "deleteMany",
            options,
        );
    }

    /** Same as `deleteMany`, but returns the deleted records. */
    async deleteManyReturning(
        where: VSRepoWhere<Entity>,
        options?: SimpleMethodOptions<Entity, OrmTypes>,
    ): Promise<Entity[]> {
        return this.execBaseMethod(
            opt => this.adapter.deleteManyReturning(this.mergeWheresResolver.resolve(opt.see, where), opt),
            "deleteManyReturning",
            options,
        );
    }

    /** Updates the record matching `where` with `update`, or creates it with `create` if none matches. */
    async upsert(
        where: VSRepoWhere<Entity>,
        create: DeepPartial<Entity>,
        update: DeepPartial<Entity>,
        options?: SimpleMethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.upsert(this.mergeWheresResolver.resolve(opt.see, where), create, update, opt),
            "upsert",
            options,
        );
    }

    /** Updates the record matching `where` and returns it. */
    async update(
        where: VSRepoWhere<Entity>,
        obj: DeepPartial<Entity>,
        options?: SimpleMethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.update(this.mergeWheresResolver.resolve(opt.see, where), obj, opt),
            "update",
            options,
        );
    }

    /** Updates the record matching the primary key. */
    async patch(
        id: PKType,
        obj: DeepPartial<Entity>,
        options?: SimpleMethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.update(this.mergeWheresResolver.resolve(opt.see, this.wherePk(id)), obj, opt),
            "patch",
            options,
        );
    }

    /** Updates every record matching `where` and returns how many were updated. */
    async updateMany(
        where: VSRepoWhere<Entity>,
        obj: DeepPartial<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<CountResult> {
        return this.execBaseMethod(
            opt => this.adapter.updateMany(this.mergeWheresResolver.resolve(opt.see, where), obj, opt),
            "updateMany",
            options,
        );
    }

    /** Same as `updateMany`, but returns the updated records. */
    async updateManyReturning(
        where: VSRepoWhere<Entity>,
        obj: DeepPartial<Entity>,
        options?: SimpleMethodOptions<Entity, OrmTypes>,
    ): Promise<Entity[]> {
        return this.execBaseMethod(
            opt => this.adapter.updateManyReturning(this.mergeWheresResolver.resolve(opt.see, where), obj, opt),
            "updateManyReturning",
            options,
        );
    }

    /**
     * Fetches a record by primary key and returns it deep-merged, in memory, with `obj`.
     * Nothing is persisted: pass the result to `save` or `patch` to write it. Returns `null` if the record doesn't exist.
     */
    async merge<U extends DeepPartial<Entity>>(
        id: PKType,
        obj: U,
        options?: SimpleMethodOptions<Entity, OrmTypes>,
    ): Promise<(U & Entity) | null> {
        return this.execBaseMethod(
            opt => this.adapter.merge<U>(this.mergeWheresResolver.resolve(opt.see, this.wherePk(id)), obj, opt),
            "merge",
            options,
        );
    }

    /** Counts the records matching `where` (all records if omitted). */
    async count(where?: VSRepoWhere<Entity>, options?: RestrictMethodOptions<Entity, OrmTypes>): Promise<number> {
        return this.execBaseMethod(
            opt => this.adapter.count(this.mergeWheresResolver.resolve(opt.see, where), opt),
            "count",
            options,
        );
    }

    /** Checks whether at least one record matches `where`. */
    async exists(where?: VSRepoWhere<Entity>, options?: RestrictMethodOptions<Entity, OrmTypes>): Promise<boolean> {
        return this.execBaseMethod(
            opt => this.adapter.exists(this.mergeWheresResolver.resolve(opt.see, where), opt),
            "exists",
            options,
        );
    }

    /** Checks whether a record with the provided primary key exists. */
    async has(id: PKType, options?: RestrictMethodOptions<Entity, OrmTypes>): Promise<boolean> {
        return this.execBaseMethod(
            opt => this.adapter.exists(this.mergeWheresResolver.resolve(opt.see, this.wherePk(id)), opt),
            "has",
            options,
        );
    }

    private failSoftDelete(): never {
        this.fail(
            "this method can only be used if you have enabled soft delete in this repository.",
            VSRepoErrorType.BASE,
        );
    }

    private getSoftDeletePayload(): DeepPartial<Entity> {
        if (!this.softDeleteField) {
            this.failSoftDelete();
        }

        return { [this.softDeleteField]: new Date() } as DeepPartial<Entity>;
    }

    private getRestorePayload(): DeepPartial<Entity> {
        if (!this.softDeleteField) {
            this.failSoftDelete();
        }

        return { [this.softDeleteField]: null } as DeepPartial<Entity>;
    }

    /** Marks the record matching `where` as deleted, setting the soft-delete field to the current date. Throws if soft delete isn't enabled (`@EnableSoftDelete`). */
    async softDelete(where: VSRepoWhere<Entity>, options?: SimpleMethodOptions<Entity, OrmTypes>): Promise<Entity> {
        const payload = this.getSoftDeletePayload();

        return this.execBaseMethod(
            opt => this.adapter.update(this.mergeWheresResolver.resolve(opt.see ?? "all", where), payload, opt),
            "softDelete",
            options,
        );
    }

    /** Marks the record matching the primary key as deleted. */
    async softRemove(id: PKType, options?: SimpleMethodOptions<Entity, OrmTypes>): Promise<Entity> {
        const payload = this.getSoftDeletePayload();

        return this.execBaseMethod(
            opt =>
                this.adapter.update(this.mergeWheresResolver.resolve(opt.see ?? "all", this.wherePk(id)), payload, opt),
            "softRemove",
            options,
        );
    }

    /** Same as `softDelete`, but for every record matching `where`. Returns how many were updated. */
    async softDeleteMany(
        where: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<CountResult> {
        const payload = this.getSoftDeletePayload();

        return this.execBaseMethod(
            opt => this.adapter.updateMany(this.mergeWheresResolver.resolve(opt.see ?? "all", where), payload, opt),
            "softDeleteMany",
            options,
        );
    }

    /** Reverts a soft delete on the record matching `where`, clearing the soft-delete field. Throws if soft delete isn't enabled. */
    async restore(where: VSRepoWhere<Entity>, options?: SimpleMethodOptions<Entity, OrmTypes>): Promise<Entity> {
        const payload = this.getRestorePayload();

        return this.execBaseMethod(
            opt => this.adapter.update(this.mergeWheresResolver.resolve(opt.see ?? "all", where), payload, opt),
            "restore",
            options,
        );
    }

    /** Reverts a soft delete on the record matching the primary key. */
    async recover(id: PKType, options?: SimpleMethodOptions<Entity, OrmTypes>): Promise<Entity> {
        const payload = this.getRestorePayload();

        return this.execBaseMethod(
            opt =>
                this.adapter.update(this.mergeWheresResolver.resolve(opt.see ?? "all", this.wherePk(id)), payload, opt),
            "recover",
            options,
        );
    }

    /** Same as `restore`, but for every record matching `where`. Returns how many were updated. */
    async restoreMany(
        where: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<CountResult> {
        const payload = this.getRestorePayload();

        return this.execBaseMethod(
            opt => this.adapter.updateMany(this.mergeWheresResolver.resolve(opt.see ?? "all", where), payload, opt),
            "restoreMany",
            options,
        );
    }

    /**
     * Atomically adds `value` to a numeric field of the record matching `where` and returns the record.
     *
     * @example
     * ```typescript
     * await productRepository.increment("stock", 5, { id: "1" });
     * ```
     */
    async increment<Field extends NumericKeys<Entity>>(
        field: Field,
        value: NonNullable<Entity[Field]>,
        where: VSRepoWhere<Entity>,
        options?: SimpleMethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.incrementOne(field, value, this.mergeWheresResolver.resolve(opt.see, where), opt),
            "increment",
            options,
        );
    }

    /** Atomically subtracts `value` from a numeric field of the record matching `where` and returns the record. */
    async decrement<Field extends NumericKeys<Entity>>(
        field: Field,
        value: NonNullable<Entity[Field]>,
        where: VSRepoWhere<Entity>,
        options?: SimpleMethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.decrementOne(field, value, this.mergeWheresResolver.resolve(opt.see, where), opt),
            "decrement",
            options,
        );
    }

    /** Atomically multiplies a numeric field of the record matching `where` by `value` and returns the record. */
    async multiply<Field extends NumericKeys<Entity>>(
        field: Field,
        value: NonNullable<Entity[Field]>,
        where: VSRepoWhere<Entity>,
        options?: SimpleMethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.multiplyOne(field, value, this.mergeWheresResolver.resolve(opt.see, where), opt),
            "multiply",
            options,
        );
    }

    /** Atomically divides a numeric field of the record matching `where` by `value` and returns the record. */
    async divide<Field extends NumericKeys<Entity>>(
        field: Field,
        value: NonNullable<Entity[Field]>,
        where: VSRepoWhere<Entity>,
        options?: SimpleMethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.divideOne(field, value, this.mergeWheresResolver.resolve(opt.see, where), opt),
            "divide",
            options,
        );
    }

    /** Same as `increment`, but for every record matching `where`. Returns how many were updated. */
    async incrementMany<Field extends NumericKeys<Entity>>(
        field: Field,
        value: NonNullable<Entity[Field]>,
        where: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<CountResult> {
        return this.execBaseMethod(
            opt => this.adapter.incrementMany(field, value, this.mergeWheresResolver.resolve(opt.see, where), opt),
            "incrementMany",
            options,
        );
    }

    /** Same as `decrement`, but for every record matching `where`. Returns how many were updated. */
    async decrementMany<Field extends NumericKeys<Entity>>(
        field: Field,
        value: NonNullable<Entity[Field]>,
        where: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<CountResult> {
        return this.execBaseMethod(
            opt => this.adapter.decrementMany(field, value, this.mergeWheresResolver.resolve(opt.see, where), opt),
            "decrementMany",
            options,
        );
    }

    /** Same as `multiply`, but for every record matching `where`. Returns how many were updated. */
    async multiplyMany<Field extends NumericKeys<Entity>>(
        field: Field,
        value: NonNullable<Entity[Field]>,
        where: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<CountResult> {
        return this.execBaseMethod(
            opt => this.adapter.multiplyMany(field, value, this.mergeWheresResolver.resolve(opt.see, where), opt),
            "multiplyMany",
            options,
        );
    }

    /** Same as `divide`, but for every record matching `where`. Returns how many were updated. */
    async divideMany<Field extends NumericKeys<Entity>>(
        field: Field,
        value: NonNullable<Entity[Field]>,
        where: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<CountResult> {
        return this.execBaseMethod(
            opt => this.adapter.divideMany(field, value, this.mergeWheresResolver.resolve(opt.see, where), opt),
            "divideMany",
            options,
        );
    }

    /**
     * Returns the sum of a numeric field across every record matching `where`.
     */
    async sum(
        field: NumericKeys<Entity>,
        where?: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<number | null> {
        return this.execBaseMethod(
            opt => this.adapter.sum(field, this.mergeWheresResolver.resolve(opt.see, where ?? {}), opt),
            "sum",
            options,
        );
    }

    /**
     * Returns the average of a numeric field across every record matching `where`.
     */
    async average(
        field: NumericKeys<Entity>,
        where?: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<number | null> {
        return this.execBaseMethod(
            opt => this.adapter.average(field, this.mergeWheresResolver.resolve(opt.see, where ?? {}), opt),
            "average",
            options,
        );
    }

    /**
     * Returns the minimum of a numeric field across every record matching `where`.
     */
    async min(
        field: NumericKeys<Entity>,
        where?: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<number | null> {
        return this.execBaseMethod(
            opt => this.adapter.min(field, this.mergeWheresResolver.resolve(opt.see, where ?? {}), opt),
            "min",
            options,
        );
    }

    /**
     * Returns the maximum of a numeric field across every record matching `where`.
     */
    async max(
        field: NumericKeys<Entity>,
        where?: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<number | null> {
        return this.execBaseMethod(
            opt => this.adapter.max(field, this.mergeWheresResolver.resolve(opt.see, where ?? {}), opt),
            "max",
            options,
        );
    }
}

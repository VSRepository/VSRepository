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
import { Pagination } from "./types/utils/pagination.type.js";
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

/**
 * ORM-agnostic base repository.
 *
 * @template Entity Type of the entity managed by the repository.
 * @template PKType Type of the entity's primary key value.
 * @template OrmTypes ORM-specific client/transaction types. See `VSRepoOrmTypes`.
 *
 * @example
 * ```typescript
 * class UserRepository extends VSRepository<User, string> {
 *     constructor() {
 *         super({ pkName: "id", adapter: new VSRepoPrisma7Adapter(prisma, "user") });
 *     }
 *
 *     @DynamicMethod()
 *     declare findByEmail: (email: string) => Promise<User[]>;
 * }
 *
 * const userRepository = new UserRepository();
 * const user = await userRepository.get("123");
 * ```
 *
 * @publicApi
 */
export abstract class VSRepository<Entity, PKType, OrmTypes extends VSRepoOrmTypes = VSRepoOrmTypes> {
    public readonly pkName: KeysOfType<Entity, PKType>;

    private readonly adapter: VSRepoAdapter<Entity>;
    private readonly mergeWheresResolver: MergeWheresResolver<Entity>;
    private readonly logger: VSLogger;

    private softDeleteField?: string;
    private readonly defaultOrdering?: Ordering<Entity>;
    private readonly vsPlaceholders: boolean;

    private dynamicMethodsResolved = false;
    private alredyWarnedResolveDynamicMethods = false;

    /**
     * This is a property managed by VSRepository, please don't modify it!!
     * @internal
     */
    _vsrepocache: Map<string, (args: any[], methodOptions?: MethodOptions<Entity, OrmTypes>) => VSRepoArgs<Entity>> =
        new Map();

    /**
     * Creates a configured instance of `VSRepository`, resolving and validating
     * every `@DynamicMethod`/`@QueryMethod` declared on the subclass.
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
        this.vsPlaceholders = options.vsPlaceholders ?? true;

        this.mergeWheresResolver = new MergeWheresResolver<Entity>(this.softDeleteField);
        this.logger = new VSLogger(options.logLevel ?? VSLogLevel.WARN, this.constructor.name + "Logger");

        this.resolveSoftDelete();

        this.logger.logInfo(
            `Initializing ${this.constructor.name} (pk: '${String(this.pkName)}'` +
                (this.softDeleteField ? `, softDeleteField: '${String(this.softDeleteField)}'` : "") +
                (this.defaultOrdering ? `, defaultOrdering: ${JSON.stringify(this.defaultOrdering)}` : "") +
                `, adapter: ${this.adapter.constructor.name}` +
                `)`,
        );

        let dynamicMethodsCount: number | undefined;
        let queryMethodsCount: number | undefined;

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
            this.constructor.prototype,
        );

        if (softDeleteMetadata?.active) {
            this.softDeleteField = softDeleteMetadata.field;
        }
    }

    /**
     * Resolves every `@DynamicMethod`/`@QueryMethod` field declared on the
     * subclass, assigning each one a working implementation on `this`.
     *
     * Called automatically at the end of the constructor unless
     * `lazyDynamicMethods: true` was passed in the options — in that case,
     * the subclass is responsible for calling it manually to make its
     * dynamic/query methods available.
     *
     * Calling this method again after it has already resolved once is
     * harmless but redundant — it just re-runs the resolution and logs a
     * `WARN`, since it's usually a sign of a mistake.
     */
    protected resolveDynamicMethods(): ResolvedMethodsResult {
        if (this.dynamicMethodsResolved && !this.alredyWarnedResolveDynamicMethods) {
            this.logger.logWarn(
                `resolveDynamicMethods() was called more than once on ${this.constructor.name}. ` +
                    `If you are calling it manually, make sure lazyDynamicMethods is set to true ` +
                    `in the constructor options to skip the automatic resolution.`,
            );

            this.alredyWarnedResolveDynamicMethods = true;
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

    private wherePkIn(pks: PKType[]): VSRepoWhere<Entity> {
        return { [this.pkName]: { in: pks } } as VSRepoWhere<Entity>;
    }

    private async execBaseMethod<R>(
        fn: (options: MethodOptions<Entity, OrmTypes>) => Promise<R>,
        methodName: string,
        options: MethodOptions<Entity, OrmTypes> = {},
    ): Promise<R> {
        options.db ??= this.getDbClient();

        const start = this.logger.startPerformLog("run " + methodName);

        try {
            const result = await fn(options);
            this.logger.endPerformLog(start);

            return result;
        } catch (err) {
            this.logger.endPerformLog(start);
            // this.logger.logError(`Failed to run '${methodName}' on ${this.constructor.name}`, err);

            throw err;
        }
    }

    /**
     * Runs `fn` inside a native transaction of the underlying ORM, sharing the
     * transaction client (`tx`) across every repository call made within it.
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

    getAdapter<A extends VSRepoAdapter<Entity> = VSRepoAdapter<Entity>>(): A {
        return this.adapter as A;
    }

    static getQueryBuilder<E, O extends VSRepoOrmTypes>(
        repository: VSRepository<E, any, O>,
        db?: ClientOrTransaction<O>,
    ): VSQueryBuilder<E, O> {
        return repository.createQueryBuilder(db);
    }

    static getRawQueryBuilder<O extends VSRepoOrmTypes>(
        repository: VSRepository<any, any, O>,
        db?: ClientOrTransaction<O>,
    ): VSRawQueryBuilder<O> {
        return repository.createRawQueryBuilder(db);
    }

    /**
     * Creates a fluent `VSQueryBuilder` for queries assembled at runtime (optional filters,
     * user-controlled ordering and pagination, ...). Nothing runs until one of its terminal methods
     * (`getResult`, `getCount`, `getResultAndCount`, ...) is called.
     *
     * @param db Client or transaction the query runs on. Defaults to the repository's client; it can
     * also be set later with `VSQueryBuilder.setDb`.
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
     * Returns a fluent `VSRawQueryBuilder`, for hand-written `SELECT` queries whose SQL is
     * too specific (window functions, vendor-specific syntax, ad-hoc subqueries, ...) for
     * `VSRepository.createQueryBuilder`'s model.
     *
     * @param db Client or transaction to run in. Defaults to the repository's own client — see
     * `VSRawQueryBuilder.setDb()` to change it later, or run inside a `transaction()`.
     *
     * @example
     * ```typescript
     * const rows = await userRepository
     *     .createRawQueryBuilder()
     *     .select("id", "name")
     *     .from("user")
     *     .where(VSSql.sql`active = ${true}`)
     *     .orderBy("name")
     *     .limit(20)
     *     .execute<User[]>();
     * ```
     */
    createRawQueryBuilder(db?: ClientOrTransaction<OrmTypes>): VSRawQueryBuilder<OrmTypes> {
        return new VSRawQueryBuilder<OrmTypes>(db ?? this.adapter.getDbClient(), this.adapter, this.logger);
    }

    /**
     * Executes a raw query/statement directly against the underlying database.
     *
     * Set `options.modifying: true` for `INSERT`/`UPDATE`/`DELETE` statements.
     *
     * @example
     * ```typescript
     * const users = await userRepository.query<User[]>(
     *     'SELECT * FROM "User" WHERE email = $1',
     *     { args: ["joao@email.com"] },
     * );
     * ```
     */
    async query<T = any>(query: string, options?: VSRepoQueryOptions<OrmTypes>): Promise<T>;
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
            query = compiled.text;
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

    async find(where?: VSRepoWhere<Entity>, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity[]> {
        return this.execBaseMethod(
            opt => this.adapter.findMany(this.mergeWheresResolver.resolve(opt.see, where), opt),
            "find",
            options,
        );
    }

    async findOne(where?: VSRepoWhere<Entity>, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity | null> {
        return this.execBaseMethod(
            opt => this.adapter.findOne(this.mergeWheresResolver.resolve(opt.see, where), opt),
            "findOne",
            options,
        );
    }

    async findOneOrThrow(where?: VSRepoWhere<Entity>, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.findOneOrThrow(this.mergeWheresResolver.resolve(opt.see, where), opt),
            "findOneOrThrow",
            options,
        );
    }

    async findOneById(id: PKType, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity | null> {
        return this.execBaseMethod(
            opt => this.adapter.findOne(this.mergeWheresResolver.resolve(opt.see, this.wherePk(id)), opt),
            "findOneById",
            options,
        );
    }

    /** Fetches all records (respects the repository's `defaultOrdering` unless `order` is provided). */
    async getAll(
        options?: MethodOptions<Entity, OrmTypes> & {
            pagination?: Pagination;
            order?: Ordering<Entity>;
        },
    ): Promise<Entity[]> {
        return this.execBaseMethod(
            (opt: MethodOptions<Entity, OrmTypes> & { order?: Ordering<Entity> }) =>
                this.adapter.findMany(this.mergeWheresResolver.resolve(opt.see, {}), {
                    ...opt,
                    order: opt.order ?? this.defaultOrdering,
                }),
            "getAll",
            options,
        );
    }

    /** Creates or updates (upsert) a record. */
    async save(obj: DeepPartial<Entity>, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity>;
    /** Creates or updates (upsert) a list of records. */
    async save(obj: DeepPartial<Entity>[], options?: MethodOptions<Entity, OrmTypes>): Promise<Entity[]>;
    async save(
        obj: DeepPartial<Entity> | DeepPartial<Entity>[],
        options?: MethodOptions<Entity, OrmTypes>,
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

    async delete(where: VSRepoWhere<Entity>, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.delete(this.mergeWheresResolver.resolve(opt.see, where), opt),
            "delete",
            options,
        );
    }

    async deleteById(id: PKType, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.delete(this.mergeWheresResolver.resolve(opt.see, this.wherePk(id)), opt),
            "deleteById",
            options,
        );
    }

    async deleteMany(where: VSRepoWhere<Entity>, options?: MethodOptions<Entity, OrmTypes>): Promise<CountResult> {
        return this.execBaseMethod(
            opt => this.adapter.deleteMany(this.mergeWheresResolver.resolve(opt.see, where), opt),
            "deleteMany",
            options,
        );
    }

    async deleteManyReturning(
        where: VSRepoWhere<Entity>,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<Entity[]> {
        return this.execBaseMethod(
            opt => this.adapter.deleteManyReturning(this.mergeWheresResolver.resolve(opt.see, where), opt),
            "deleteManyReturning",
            options,
        );
    }

    async update(
        where: VSRepoWhere<Entity>,
        obj: DeepPartial<Entity>,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.update(this.mergeWheresResolver.resolve(opt.see, where), obj, opt),
            "update",
            options,
        );
    }

    async updateById(id: PKType, obj: DeepPartial<Entity>, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.update(this.mergeWheresResolver.resolve(opt.see, this.wherePk(id)), obj, opt),
            "updateById",
            options,
        );
    }

    async updateMany(
        where: VSRepoWhere<Entity>,
        obj: DeepPartial<Entity>,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<CountResult> {
        return this.execBaseMethod(
            opt => this.adapter.updateMany(this.mergeWheresResolver.resolve(opt.see, where), obj, opt),
            "updateMany",
            options,
        );
    }

    async updateManyReturning(
        where: VSRepoWhere<Entity>,
        obj: DeepPartial<Entity>,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<Entity[]> {
        return this.execBaseMethod(
            opt => this.adapter.updateManyReturning(this.mergeWheresResolver.resolve(opt.see, where), obj, opt),
            "updateManyReturning",
            options,
        );
    }

    /**
     * Fetches a record by PK and returns it deep-merged, in memory, with the
     * provided object — does **not** persist anything (pass the result to
     * `save`/`updateById` yourself to write it).
     */
    async merge<U extends DeepPartial<Entity>>(
        id: PKType,
        obj: U,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<(U & Entity) | null> {
        return this.execBaseMethod(
            opt => this.adapter.merge<U>(this.mergeWheresResolver.resolve(opt.see, this.wherePk(id)), obj, opt),
            "merge",
            options,
        );
    }

    async count(where?: VSRepoWhere<Entity>, options?: RestrictMethodOptions<Entity, OrmTypes>): Promise<number> {
        return this.execBaseMethod(
            opt => this.adapter.count(this.mergeWheresResolver.resolve(opt.see, where), opt),
            "count",
            options,
        );
    }

    async exists(where?: VSRepoWhere<Entity>, options?: RestrictMethodOptions<Entity, OrmTypes>): Promise<boolean> {
        return this.execBaseMethod(
            opt => this.adapter.exists(this.mergeWheresResolver.resolve(opt.see, where), opt),
            "exists",
            options,
        );
    }

    async existsById(id: PKType, options?: RestrictMethodOptions<Entity, OrmTypes>): Promise<boolean> {
        return this.execBaseMethod(
            opt => this.adapter.exists(this.mergeWheresResolver.resolve(opt.see, this.wherePk(id)), opt),
            "existsById",
            options,
        );
    }

    /** Marks a record as deleted (soft-delete). Requires `softDeleteField` to be configured on the repository. */
    async softRemove(pk: PKType, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        if (!this.softDeleteField) {
            this.fail(
                "this method can only be used if you have configured 'softDeleteField' in this repository.",
                VSRepoErrorType.BASE,
            );
        }

        const key = this.softDeleteField;

        return this.execBaseMethod(
            opt =>
                this.adapter.update(
                    this.mergeWheresResolver.resolve(opt.see ?? "all", this.wherePk(pk)),
                    { [key]: new Date() } as DeepPartial<Entity>,
                    opt,
                ),
            "softRemove",
            options,
        );
    }

    /** Marks multiple records as deleted (soft-delete) in batch. Requires `softDeleteField` to be configured on the repository. */
    async softRemoveList(pks: PKType[], options?: RestrictMethodOptions<Entity, OrmTypes>): Promise<CountResult> {
        if (!this.softDeleteField) {
            this.fail(
                "this method can only be used if you have configured 'softDeleteField' in this repository.",
                VSRepoErrorType.BASE,
            );
        }
        if (!Array.isArray(pks)) {
            this.fail("'pks' must be a valid array", VSRepoErrorType.BASE);
        }

        const key = this.softDeleteField;

        return this.execBaseMethod(
            opt =>
                this.adapter.updateMany(
                    this.mergeWheresResolver.resolve(opt.see ?? "all", this.wherePkIn(pks)),
                    { [key]: new Date() } as DeepPartial<Entity>,
                    opt,
                ),
            "softRemoveList",
            options,
        );
    }

    /** Restores a record previously marked as deleted (soft-delete). Requires `softDeleteField` to be configured on the repository. */
    async restore(pk: PKType, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        if (!this.softDeleteField) {
            this.fail(
                "this method can only be used if you have configured 'softDeleteField' in this repository.",
                VSRepoErrorType.BASE,
            );
        }

        const key = this.softDeleteField;

        return this.execBaseMethod(
            opt =>
                this.adapter.update(
                    this.mergeWheresResolver.resolve(opt.see ?? "all", this.wherePk(pk)),
                    { [key]: null } as DeepPartial<Entity>,
                    opt,
                ),
            "restore",
            options,
        );
    }

    /** Restores multiple records previously marked as deleted (soft-delete) in batch. Requires `softDeleteField` to be configured on the repository. */
    async restoreList(pks: PKType[], options?: RestrictMethodOptions<Entity, OrmTypes>): Promise<CountResult> {
        if (!this.softDeleteField) {
            this.fail(
                "this method can only be used if you have configured 'softDeleteField' in this repository.",
                VSRepoErrorType.BASE,
            );
        }
        if (!Array.isArray(pks)) {
            this.fail("'pks' must be a valid array", VSRepoErrorType.BASE);
        }

        const key = this.softDeleteField;

        return this.execBaseMethod(
            opt =>
                this.adapter.updateMany(
                    this.mergeWheresResolver.resolve(opt.see ?? "all", this.wherePkIn(pks)),
                    { [key]: null } as DeepPartial<Entity>,
                    opt,
                ),
            "restoreList",
            options,
        );
    }

    /**
     * Atomically adds `value` to a numeric field of the record identified by `id`.
     */
    async increment<Field extends NumericKeys<Entity>>(
        pk: PKType,
        field: Field,
        value: NonNullable<Entity[Field]>,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        return this.execBaseMethod(
            opt =>
                this.adapter.incrementOne(
                    field,
                    value,
                    this.mergeWheresResolver.resolve(opt.see, this.wherePk(pk)),
                    opt,
                ),
            "increment",
            options,
        );
    }

    async decrement<Field extends NumericKeys<Entity>>(
        pk: PKType,
        field: Field,
        value: NonNullable<Entity[Field]>,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        return this.execBaseMethod(
            opt =>
                this.adapter.decrementOne(
                    field,
                    value,
                    this.mergeWheresResolver.resolve(opt.see, this.wherePk(pk)),
                    opt,
                ),
            "decrement",
            options,
        );
    }

    async multiply<Field extends NumericKeys<Entity>>(
        pk: PKType,
        field: Field,
        value: NonNullable<Entity[Field]>,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        return this.execBaseMethod(
            opt =>
                this.adapter.multiplyOne(
                    field,
                    value,
                    this.mergeWheresResolver.resolve(opt.see, this.wherePk(pk)),
                    opt,
                ),
            "multiply",
            options,
        );
    }

    async divide<Field extends NumericKeys<Entity>>(
        pk: PKType,
        field: Field,
        value: NonNullable<Entity[Field]>,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        return this.execBaseMethod(
            opt =>
                this.adapter.divideOne(field, value, this.mergeWheresResolver.resolve(opt.see, this.wherePk(pk)), opt),
            "divide",
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

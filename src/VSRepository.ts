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
import { VSRepoValidator } from "./internal/validators/vsrepo.validator.js";
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

/**
 * ORM-agnostic base repository, exposing a complete set of ready-to-use CRUD
 * and soft-delete methods around an entity, plus any `@DynamicMethod`/`@QueryMethod`
 * decorated methods declared on the subclass.
 *
 * Unlike the previous (v1) `VSRepository`, this class delegates every
 * operation to a `VSRepoAdapter` instead of talking to Prisma directly, which
 * is what allows it to work with any ORM/database that has an adapter
 * implementation (e.g. Prisma, TypeORM).
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
    private readonly validator: VSRepoValidator<Entity, PKType, OrmTypes>;

    private readonly softRemoveKey?: keyof Entity;
    private readonly defaultOrdering?: Ordering<Entity>;
    private readonly vsPlaceholders: boolean;

    /**
     * Whether `resolveDynamicMethods` has already run once for this instance.
     * Used to warn on redundant re-resolutions (e.g. calling it manually
     * more than once, or on top of an already-eager resolution).
     */
    private dynamicMethodsResolved = false;

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
        this.validator = new VSRepoValidator<Entity, PKType, OrmTypes>();

        const optionsValidated = this.validator.validateConstructorOptions(options);

        this.adapter = optionsValidated.adapter;

        if (optionsValidated.pkName) {
            this.pkName = optionsValidated.pkName;
        } else if (this.adapter.getPkName) {
            this.pkName = this.adapter.getPkName() as KeysOfType<Entity, PKType>;
        } else {
            throw new VSRepoError(
                "Your adapter did not implement the 'getPkName' method; try updating your adapter to a newer version or manually configure 'pkName' in the constructor's 'options'.",
                VSRepoErrorType.VALIDATOR,
            );
        }

        this.softRemoveKey = optionsValidated.softRemoveKey;
        this.defaultOrdering = optionsValidated.defaultOrdering;
        this.vsPlaceholders = optionsValidated.vsPlaceholders ?? false;

        if (this.vsPlaceholders && !this.adapter.getPlaceholder) {
            throw new VSRepoError(
                "'vsPlaceholders' is enabled but your adapter did not implement the 'getPlaceholder' method; try updating your adapter to a newer version or disable 'vsPlaceholders'.",
                VSRepoErrorType.VALIDATOR,
            );
        }

        this.mergeWheresResolver = new MergeWheresResolver<Entity>(this.softRemoveKey);
        this.logger = new VSLogger(
            optionsValidated.logLevel ?? VSLogLevel.WARN,
            this.constructor.name + "Logger",
            optionsValidated.logSlowThresholdMs,
        );
        this.validator.setLogger(this.logger);

        this.logger.logInfo(
            `Initializing ${this.constructor.name} (pk: '${String(this.pkName)}'` +
                (this.softRemoveKey ? `, softRemoveKey: '${String(this.softRemoveKey)}'` : "") +
                (this.defaultOrdering ? `, defaultOrdering: ${JSON.stringify(this.defaultOrdering)}` : "") +
                `, adapter: ${this.adapter.constructor.name}` +
                `)`,
        );

        let dynamicMethodsCount: number | undefined;
        let queryMethodsCount: number | undefined;

        if (!optionsValidated.lazyDynamicMethods) {
            const result = this.resolveDynamicMethods();
            dynamicMethodsCount = result.dynamicMethodsCount;
            queryMethodsCount = result.queryMethodsCount;
        }

        this.logger.logInfo(
            `${this.constructor.name} ready (${optionsValidated.lazyDynamicMethods ? "Resolution of dynamic methods postponed" : `${dynamicMethodsCount} dynamic method(s), ${queryMethodsCount} query method(s) resolved`})`,
        );
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
    protected resolveDynamicMethods(): { dynamicMethodsCount: number; queryMethodsCount: number } {
        if (this.dynamicMethodsResolved) {
            this.logger.logWarn(
                `resolveDynamicMethods() was called more than once on ${this.constructor.name}. ` +
                    `If you are calling it manually, make sure lazyDynamicMethods is set to true ` +
                    `in the constructor options to skip the automatic resolution.`,
            );
        }

        const dynamicMethodsResolver = new DynamicMethodsResolver<Entity, PKType>(
            this.logger,
            this.adapter,
            this.mergeWheresResolver,
            this.validator,
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

    // * Loga o erro antes de lançar, pra guard clauses (mau uso da API) não passarem em silêncio
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
        fn: (optionsChecked: MethodOptions<Entity, OrmTypes>) => Promise<R>,
        methodName: string,
        optionsUnchecked: unknown,
        opsType: "common" | "getAll" | "restrict" = "common",
    ): Promise<R> {
        const optionsChecked =
            opsType === "common"
                ? this.validator.validateMethodOptions(optionsUnchecked)
                : opsType === "restrict"
                  ? this.validator.validateRestrictMethodOptions(optionsUnchecked)
                  : this.validator.validateGetAllMethodOptions(optionsUnchecked);

        optionsChecked.db ??= this.getDbClient();

        const start = this.logger.startPerformLog("run " + methodName);

        try {
            const result = await fn(optionsChecked);
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

        return this.adapter.runInTransaction(fn, this.validator.validateTransactionOptions(options));
    }

    /** Returns the underlying ORM client instance used outside of transactions. */
    getDbClient<DB extends any = OrmTypes["dbClient"]>(): DB {
        return this.adapter.getDbClient();
    }

    /**
     * Creates a fluent {@link VSQueryBuilder} for queries assembled at runtime (optional filters,
     * user-controlled ordering and pagination, ...). Nothing runs until one of its terminal methods
     * (`getResult`, `getCount`, `getResultAndCount`, ...) is called.
     *
     * @param db Client or transaction the query runs on. Defaults to the repository's client; it can
     * also be set later with {@link VSQueryBuilder.setDb}.
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
    createQueryBuilder(db?: OrmTypes["dbClient"] | OrmTypes["dbTransaction"]): VSQueryBuilder<Entity, OrmTypes> {
        return new VSQueryBuilder(
            db ?? this.adapter.getDbClient(),
            this.adapter,
            this.mergeWheresResolver,
            this.logger,
        );
    }

    /**
     * Returns a fluent {@link VSRawQueryBuilder}, for hand-written `SELECT` queries whose SQL is
     * too specific (window functions, vendor-specific syntax, ad-hoc subqueries, ...) for
     * {@link VSRepository.createQueryBuilder}'s `where`/`relations` model.
     *
     * Goes through the same adapter as every other method, and requires the adapter to implement
     * `getPlaceholder()` (see {@link VSSql}). Nothing runs until
     * {@link VSRawQueryBuilder.execute} is called.
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
    createRawQueryBuilder(db?: OrmTypes["dbClient"] | OrmTypes["dbTransaction"]): VSRawQueryBuilder<OrmTypes> {
        return new VSRawQueryBuilder<OrmTypes>(db ?? this.adapter.getDbClient(), this.adapter, this.logger);
    }

    /**
     * Executes a raw query/statement directly against the underlying database.
     *
     * Accepts either a plain SQL string — use placeholders for values passed
     * via `options.args`, never interpolate values directly into `query`, to
     * avoid SQL injection; the placeholder syntax depends on the
     * database/driver behind your adapter — or a `VSSql` fragment built with
     * `VSSql.sql`/`raw`/`join`/`empty`, which is parameterized automatically
     * and compiled using your adapter's own placeholder syntax (requires the
     * adapter to implement `getPlaceholder()`; see {@link VSSql}).
     *
     * Set `options.modifying: true` for `INSERT`/`UPDATE`/`DELETE` statements.
     * Set `options.singleResult: true` to collapse an array result into its
     * first element (`null` if empty).
     *
     * @example
     * ```typescript
     * const users = await userRepository.query<User[]>(
     *     'SELECT * FROM "user" WHERE email = $1',
     *     { args: ["joao@email.com"] },
     * );
     *
     * const affected = await userRepository.query<number>(
     *     'UPDATE "user" SET active = true WHERE id = $1',
     *     { args: ["123"], modifying: true },
     * );
     *
     * // Only one row is ever expected here, so `singleResult` collapses the
     * // array into a single object (or `null` when no row matches).
     * const user = await userRepository.query<User | null>(
     *     'SELECT * FROM "user" WHERE id = $1 LIMIT 1',
     *     { args: ["123"], singleResult: true },
     * );
     *
     * // Same thing, built with a `VSSql` fragment instead of a hand-written
     * // placeholder string — `email` is still sent as a parameter.
     * const usersViaSql = await userRepository.query<User[]>(VSSql.sql`SELECT * FROM "user" WHERE email = ${"joao@email.com"}`);
     *
     * // With `vsPlaceholders: true` in the constructor options, plain
     * // strings use VSRepository's own `?1`, `?2`, ... placeholders instead
     * // of the adapter's native syntax — `?1` may repeat to reuse an arg.
     * const usersViaVsPlaceholders = await userRepository.query<User[]>(
     *     'SELECT * FROM "user" WHERE email = ?1',
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
                : typeof queryOrSql === "string" && this.vsPlaceholders
                  ? VSPlaceholdersParser.parse(queryOrSql, args ?? [])
                  : undefined;

        if (sqlFragment) {
            if (!this.adapter.getPlaceholder) {
                this.fail(
                    "Your adapter did not implement the 'getPlaceholder' method, required to compile a 'VSSql' fragment or a 'vsPlaceholders' query; try updating your adapter to a newer version.",
                    VSRepoErrorType.VALIDATOR,
                );
            }

            const compiled = sqlFragment.compile(index => this.adapter.getPlaceholder!(index));
            query = compiled.text;
            args = compiled.args;
        } else if (typeof queryOrSql === "string") {
            query = queryOrSql;
        } else {
            this.fail("'query' must be a valid string or a 'VSSql' fragment", VSRepoErrorType.BASE);
        }

        const optionsValidated = this.validator.validateQueryOptions({ ...options, args });
        optionsValidated.db ??= this.getDbClient();

        this.logger.logDebug(`${this.constructor.name} query:`, {
            query,
            args: optionsValidated.args ?? [],
            modifying: optionsValidated.modifying ?? false,
            singleResult: optionsValidated.singleResult ?? false,
        });

        const start = this.logger.startPerformLog("run query");

        try {
            const result = await this.adapter.query<T>(query, {
                args: optionsValidated.args,
                db: optionsValidated.db,
                modifying: optionsValidated.modifying ?? false,
            });

            const resolved = optionsValidated.singleResult && Array.isArray(result) ? (result[0] ?? null) : result;

            this.logger.endPerformLog(start);

            return resolved;
        } catch (err) {
            this.logger.endPerformLog(start);
            // this.logger.logError(`Failed to run 'query' on ${this.constructor.name}`, err);

            throw err;
        }
    }

    /** Fetches a record by its primary key (PK). */
    async get(pk: PKType, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity | null> {
        return this.execBaseMethod(
            opt => this.adapter.findOne(this.mergeWheresResolver.resolve(opt.see, this.wherePk(pk)), opt),
            "get",
            options,
        );
    }

    /** Fetches a record by PK and throws an Error if not found. */
    async getOrThrow(pk: PKType, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.findOneOrThrow(this.mergeWheresResolver.resolve(opt.see, this.wherePk(pk)), opt),
            "getOrThrow",
            options,
        );
    }

    /** Fetches multiple records by a list of primary keys (PKs). */
    async getList(pks: PKType[], options?: MethodOptions<Entity, OrmTypes>): Promise<Entity[]> {
        if (!Array.isArray(pks)) {
            this.fail("'pks' must be a valid array", VSRepoErrorType.BASE);
        }

        return this.execBaseMethod(
            opt => this.adapter.findMany(this.mergeWheresResolver.resolve(opt.see, this.wherePkIn(pks)), opt),
            "getList",
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
            "getAll",
        );
    }

    /** Creates or updates (upsert) a record. */
    async save(obj: DeepPartial<Entity>, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        return this.execBaseMethod(opt => this.adapter.save(obj, opt), "save", options);
    }

    /** Creates or updates (upsert) multiple records in a single operation. */
    async saveList(
        objs: DeepPartial<Entity>[],
        options?: MethodOptions<Entity, OrmTypes> & { db?: OrmTypes["dbTransaction"] },
    ): Promise<Entity[]> {
        if (!Array.isArray(objs)) {
            this.fail("'objs' must be a valid array", VSRepoErrorType.BASE);
        }

        return this.execBaseMethod(opt => this.adapter.saveMany(objs, opt), "saveList", options);
    }

    /** Deletes a record identified by its primary key (PK). */
    async remove(pk: PKType, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.delete(this.mergeWheresResolver.resolve(opt.see, this.wherePk(pk)), opt),
            "remove",
            options,
        );
    }

    /** Deletes multiple records by their primary keys, returning the count of affected rows. */
    async removeList(pks: PKType[], options?: RestrictMethodOptions<Entity, OrmTypes>): Promise<CountResult> {
        if (!Array.isArray(pks)) {
            this.fail("'pks' must be a valid array", VSRepoErrorType.BASE);
        }

        return this.execBaseMethod(
            opt => this.adapter.deleteMany(this.mergeWheresResolver.resolve(opt.see, this.wherePkIn(pks)), opt),
            "removeList",
            options,
            "restrict",
        );
    }

    /** Partially updates an existing record by its primary key (PK). */
    async patch(pk: PKType, obj: DeepPartial<Entity>, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        return this.execBaseMethod(
            opt => this.adapter.update(this.mergeWheresResolver.resolve(opt.see, this.wherePk(pk)), obj, opt),
            "patch",
            options,
        );
    }

    /**
     * Fetches a record by PK and returns it deep-merged, in memory, with the
     * provided object — does **not** persist anything (pass the result to
     * `save`/`patch` yourself to write it).
     */
    async merge<U extends DeepPartial<Entity>>(
        pk: PKType,
        obj: U,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<(U & Entity) | null> {
        return this.execBaseMethod(
            opt => this.adapter.merge<U>(this.mergeWheresResolver.resolve(opt.see, this.wherePk(pk)), obj, opt),
            "merge",
            options,
        );
    }

    /** Returns the total number of records. */
    async total(options?: RestrictMethodOptions<Entity, OrmTypes>): Promise<number> {
        return this.execBaseMethod(
            opt => this.adapter.count(this.mergeWheresResolver.resolve(opt.see, {}), opt),
            "total",
            options,
            "restrict",
        );
    }

    /** Checks whether a record exists by its primary key (PK). */
    async has(pk: PKType, options?: RestrictMethodOptions<Entity, OrmTypes>): Promise<boolean> {
        return this.execBaseMethod(
            opt => this.adapter.exists(this.mergeWheresResolver.resolve(opt.see, this.wherePk(pk)), opt),
            "has",
            options,
            "restrict",
        );
    }

    /** Marks a record as deleted (soft-delete). Requires `softRemoveKey` to be configured on the repository. */
    async softRemove(pk: PKType, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        if (!this.softRemoveKey) {
            this.fail(
                "this method can only be used if you have configured 'softRemoveKey' in this repository.",
                VSRepoErrorType.BASE,
            );
        }

        const key = this.softRemoveKey;

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

    /** Marks multiple records as deleted (soft-delete) in batch. Requires `softRemoveKey` to be configured on the repository. */
    async softRemoveList(pks: PKType[], options?: RestrictMethodOptions<Entity, OrmTypes>): Promise<CountResult> {
        if (!this.softRemoveKey) {
            this.fail(
                "this method can only be used if you have configured 'softRemoveKey' in this repository.",
                VSRepoErrorType.BASE,
            );
        }
        if (!Array.isArray(pks)) {
            this.fail("'pks' must be a valid array", VSRepoErrorType.BASE);
        }

        const key = this.softRemoveKey;

        return this.execBaseMethod(
            opt =>
                this.adapter.updateMany(
                    this.mergeWheresResolver.resolve(opt.see ?? "all", this.wherePkIn(pks)),
                    { [key]: new Date() } as DeepPartial<Entity>,
                    opt,
                ),
            "softRemoveList",
            options,
            "restrict",
        );
    }

    /** Restores a record previously marked as deleted (soft-delete). Requires `softRemoveKey` to be configured on the repository. */
    async restore(pk: PKType, options?: MethodOptions<Entity, OrmTypes>): Promise<Entity> {
        if (!this.softRemoveKey) {
            this.fail(
                "this method can only be used if you have configured 'softRemoveKey' in this repository.",
                VSRepoErrorType.BASE,
            );
        }

        const key = this.softRemoveKey;

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

    /** Restores multiple records previously marked as deleted (soft-delete) in batch. Requires `softRemoveKey` to be configured on the repository. */
    async restoreList(pks: PKType[], options?: RestrictMethodOptions<Entity, OrmTypes>): Promise<CountResult> {
        if (!this.softRemoveKey) {
            this.fail(
                "this method can only be used if you have configured 'softRemoveKey' in this repository.",
                VSRepoErrorType.BASE,
            );
        }
        if (!Array.isArray(pks)) {
            this.fail("'pks' must be a valid array", VSRepoErrorType.BASE);
        }

        const key = this.softRemoveKey;

        return this.execBaseMethod(
            opt =>
                this.adapter.updateMany(
                    this.mergeWheresResolver.resolve(opt.see ?? "all", this.wherePkIn(pks)),
                    { [key]: null } as DeepPartial<Entity>,
                    opt,
                ),
            "restoreList",
            options,
            "restrict",
        );
    }

    /**
     * Atomically adds `value` to a numeric field of the record identified
     * by `pk`, evaluated server-side against the row's current value (e.g.
     * `saldo = saldo + value`) — not a fetch-then-save round trip.
     */
    async increment<Field extends NumericKeys<Entity>>(
        pk: PKType,
        field: Field,
        value: NonNullable<Entity[Field]>,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        this.validator.assertIsNumericLike(value);

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

    /** Same as {@link VSRepository.increment}, subtracting `value` instead of adding it. */
    async decrement<Field extends NumericKeys<Entity>>(
        pk: PKType,
        field: Field,
        value: NonNullable<Entity[Field]>,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        this.validator.assertIsNumericLike(value);

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

    /** Same as {@link VSRepository.increment}, multiplying the field's current value by `value`. */
    async multiply<Field extends NumericKeys<Entity>>(
        pk: PKType,
        field: Field,
        value: NonNullable<Entity[Field]>,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        this.validator.assertIsNumericLike(value);

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

    /**
     * Same as {@link VSRepository.increment}, dividing the field's current
     * value by `value`. Division-by-zero behavior depends on the adapter/
     * underlying database (see {@link VSRepoAdapter.divideOne}).
     */
    async divide<Field extends NumericKeys<Entity>>(
        pk: PKType,
        field: Field,
        value: NonNullable<Entity[Field]>,
        options?: MethodOptions<Entity, OrmTypes>,
    ): Promise<Entity> {
        this.validator.assertIsNumericLike(value);

        return this.execBaseMethod(
            opt =>
                this.adapter.divideOne(field, value, this.mergeWheresResolver.resolve(opt.see, this.wherePk(pk)), opt),
            "divide",
            options,
        );
    }

    /**
     * Returns the sum of a numeric field across every record matching
     * `where` (all records if omitted), or `null` if none match — mirrors
     * SQL's `SUM()`, which returns `NULL` (not `0`) over an empty set.
     */
    async sum(
        field: NumericKeys<Entity>,
        where?: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<number | null> {
        const validatedWhere = this.validator.validateWhere(where ?? {});

        return this.execBaseMethod(
            opt => this.adapter.sum(field, this.mergeWheresResolver.resolve(opt.see, validatedWhere), opt),
            "sum",
            options,
            "restrict",
        );
    }

    /** Same as {@link VSRepository.sum}, but the arithmetic mean instead of the total. */
    async average(
        field: NumericKeys<Entity>,
        where?: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<number | null> {
        const validatedWhere = this.validator.validateWhere(where ?? {});

        return this.execBaseMethod(
            opt => this.adapter.average(field, this.mergeWheresResolver.resolve(opt.see, validatedWhere), opt),
            "average",
            options,
            "restrict",
        );
    }

    /** Same as {@link VSRepository.sum}, but the minimum value instead of the total. */
    async min(
        field: NumericKeys<Entity>,
        where?: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<number | null> {
        const validatedWhere = this.validator.validateWhere(where ?? {});

        return this.execBaseMethod(
            opt => this.adapter.min(field, this.mergeWheresResolver.resolve(opt.see, validatedWhere), opt),
            "min",
            options,
            "restrict",
        );
    }

    /** Same as {@link VSRepository.sum}, but the maximum value instead of the total. */
    async max(
        field: NumericKeys<Entity>,
        where?: VSRepoWhere<Entity>,
        options?: RestrictMethodOptions<Entity, OrmTypes>,
    ): Promise<number | null> {
        const validatedWhere = this.validator.validateWhere(where ?? {});

        return this.execBaseMethod(
            opt => this.adapter.max(field, this.mergeWheresResolver.resolve(opt.see, validatedWhere), opt),
            "max",
            options,
            "restrict",
        );
    }
}

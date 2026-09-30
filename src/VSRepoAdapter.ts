import { AdapterMethodOptions } from "./types/adapter/adapter-method-options.type.js";
import { AdapterQueryOptions } from "./types/adapter/adapter-query-options.type.js";
import { CountResult } from "./types/utils/count-result.type.js";
import { DeepPartial } from "./types/utils/deep-partial.type.js";
import { NumericKeys } from "./types/utils/numeric-keys.type.js";
import { VSRepoTransactionOptions } from "./types/vsrepo/vsrepo-transaction-options.type.js";
import { VSRepoWhere } from "./types/vsrepo/vsrepo-where.type.js";

/**
 * Contract implemented by ORM-specific adapters (e.g. Prisma, TypeORM) that
 * `VSRepository` delegates every operation to.
 *
 * Implementing this class is what makes `VSRepository` usable with a given
 * ORM/database: `VSRepository` never talks to the ORM directly, it only
 * calls these methods with already-resolved `VSRepoWhere`/`AdapterMethodOptions`.
 *
 * @template T Entity type this adapter operates on.
 *
 * @publicApi
 */
export abstract class VSRepoAdapter<T> {
    /** Runs `fn` inside a native transaction of the underlying ORM/database. */
    public abstract runInTransaction<R>(fn: (tx: any) => Promise<R>, options?: VSRepoTransactionOptions): Promise<R>;

    /** Returns the underlying ORM client instance used outside of transactions. */
    public abstract getDbClient(): any;

    /** Executes a raw query/statement against the underlying database, used by `@QueryMethod`. */
    public abstract query<T = any>(query: string, options?: AdapterQueryOptions): Promise<T>;

    /** Fetches a single record matching `where`. */
    public abstract findOne(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<T | null>;

    /** Fetches a single record matching `where`, throwing if none is found. */
    public abstract findOneOrThrow(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<T>;

    /** Fetches all records matching `where`. */
    public abstract findMany(
        where: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T> & { distinct?: (keyof T)[] },
    ): Promise<T[]>;

    /** Creates or updates (upsert) a single record. */
    public abstract save(obj: DeepPartial<T>, options?: AdapterMethodOptions<T>): Promise<T>;

    /** Creates or updates (upsert) multiple records in a single operation. */
    public abstract saveMany(objs: DeepPartial<T>[], options?: AdapterMethodOptions<T>): Promise<T[]>;

    /** Creates a single record. */
    public abstract create(objs: DeepPartial<T>, options?: AdapterMethodOptions<T>): Promise<T>;

    /** Creates multiple records in a single operation. */
    public abstract createMany(
        objs: DeepPartial<T>[],
        options?: AdapterMethodOptions<T> & { ignoreConflicts?: boolean },
    ): Promise<CountResult>;

    /** Creates multiple records in a single operation, returning the created records. */
    public abstract createManyReturning(
        objs: DeepPartial<T>[],
        options?: AdapterMethodOptions<T> & { ignoreConflicts?: boolean },
    ): Promise<T[]>;

    /** Deletes a single record matching `where`. */
    public abstract delete(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<T>;

    /** Deletes every record matching `where`, returning the count of affected rows. */
    public abstract deleteMany(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<CountResult>;

    /** Deletes every record matching `where`, returning the deleted records. */
    public abstract deleteManyReturning(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<T[]>;

    /** Updates a single record matching `where`. */
    public abstract update(where: VSRepoWhere<T>, obj: DeepPartial<T>, options?: AdapterMethodOptions<T>): Promise<T>;

    /** Updates every record matching `where`, returning the count of affected rows. */
    public abstract updateMany(
        where: VSRepoWhere<T>,
        obj: DeepPartial<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<CountResult>;

    /** Updates every record matching `where`, returning the updated records. */
    public abstract updateManyReturning(
        where: VSRepoWhere<T>,
        obj: DeepPartial<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<T[]>;

    /** Returns the number of records matching `where`. */
    public abstract count(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<number>;

    /** Checks whether at least one record matching `where` exists. */
    public abstract exists(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<boolean>;

    /**
     * Fetches a single record matching `where` and returns it deep-merged, in
     * memory, with the provided object — does **not** persist anything.
     */
    public abstract merge<K extends DeepPartial<T>>(
        where: VSRepoWhere<T>,
        obj: K,
        options?: AdapterMethodOptions<T>,
    ): Promise<(K & T) | null>;

    /** Creates a record if none matches `where`, otherwise updates it. */
    public abstract upsert(
        where: VSRepoWhere<T>,
        create: DeepPartial<T>,
        update: DeepPartial<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<T>;

    /**
     * Atomically adds `value` to `field` on the single record matching
     * `where` — equivalent to `UPDATE ... SET field = field + value WHERE
     * ...`, evaluated server-side against the row's current value (not a
     * client-side read-modify-write).
     *
     * Implementations must return the record reflecting the state *after*
     * the write. If the underlying ORM's atomic-update API doesn't already
     * return the updated row (e.g. it only returns an affected-row count),
     * issue a follow-up read instead of returning a stale in-memory copy.
     */
    public abstract incrementOne<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<T>;

    /** Same as {@link VSRepoAdapter.incrementOne}, subtracting `value` instead of adding it. */
    public abstract decrementOne<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<T>;

    /** Same as {@link VSRepoAdapter.incrementOne}, multiplying the field's current value by `value`. */
    public abstract multiplyOne<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<T>;

    /**
     * Same as {@link VSRepoAdapter.incrementOne}, dividing the field's
     * current value by `value`. Division-by-zero behavior is not
     * standardized by this contract — it is whatever the underlying
     * database/driver does natively (e.g. Postgres raises a
     * `division_by_zero` error); document your adapter's actual behavior.
     */
    public abstract divideOne<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<T>;

    /**
     * Returns the sum of `field` across every record matching `where` (all
     * records if `where` is omitted/empty), or `null` if no record
     * matches — mirroring SQL's `SUM()`, which returns `NULL` (not `0`)
     * over an empty set.
     */
    public abstract sum(
        field: NumericKeys<T>,
        where?: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<number | null>;

    /** Same as {@link VSRepoAdapter.sum}, but the arithmetic mean (`AVG()`) instead of the total. */
    public abstract average(
        field: NumericKeys<T>,
        where?: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<number | null>;

    /** Same as {@link VSRepoAdapter.sum}, but the minimum value (`MIN()`) instead of the total. */
    public abstract min(
        field: NumericKeys<T>,
        where?: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<number | null>;

    /** Same as {@link VSRepoAdapter.sum}, but the maximum value (`MAX()`) instead of the total. */
    public abstract max(
        field: NumericKeys<T>,
        where?: VSRepoWhere<T>,
        options?: AdapterMethodOptions<T>,
    ): Promise<number | null>;

    /** Optional method for the adapter itself to return the "pkName", instead of the user having to configure it manually in the VSRepository constructor. */
    public getPkName?(): string;

    /**
     * Optional method for the adapter to declare the placeholder syntax its
     * database/driver expects in a raw `query()` string, given the 0-based
     * position of the parameter in the `args` array (e.g. Postgres would
     * return `` `$${index + 1}` ``, SQLite/MySQL would ignore `index` and
     * always return `"?"`).
     *
     * Implementing this is what lets `VSRepository.query()` accept a `VSSql`
     * fragment (built with `VSSql.sql`/`raw`/`join`/`empty`) in addition to a
     * plain string: without it, passing a `VSSql` fragment throws.
     */
    public getPlaceholder?(index: number): string;
}

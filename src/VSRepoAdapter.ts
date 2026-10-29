import { AdapterMethodOptions } from "./types/adapter/adapter-method-options.type.js";
import { AdapterQueryOptions } from "./types/adapter/adapter-query-options.type.js";
import { RestrictAdapterMethodOptions } from "./types/adapter/restrict-adapter-method-options.type.js";
import { SimpleAdapterMethodOptions } from "./types/adapter/simple-adapter-method-options.type.js";
import { CountResult } from "./types/utils/count-result.type.js";
import { DeepPartial } from "./types/utils/deep-partial.type.js";
import { NumericKeys } from "./types/utils/numeric-keys.type.js";
import { WithIgnoreConflicts } from "./types/utils/with-ignore-conflicts.type.js";
import { VSRepoTransactionOptions } from "./types/vsrepo/vsrepo-transaction-options.type.js";
import { VSRepoWhere } from "./types/vsrepo/vsrepo-where.type.js";

/**
 * Contract implemented by ORM-specific adapters (e.g. Prisma, Drizzle). `VSRepository` never talks
 * to the ORM directly: it resolves `where` and options, then delegates every operation to these methods.
 *
 * @publicApi
 */
export abstract class VSRepoAdapter<T> {
    /** Runs `fn` inside a native transaction of the underlying ORM/database. */
    public abstract runInTransaction<R>(fn: (tx: any) => Promise<R>, options?: VSRepoTransactionOptions): Promise<R>;

    /** Returns the underlying ORM client instance used outside of transactions. */
    public abstract getDbClient(): any;

    /** Executes a raw query/statement against the underlying database. Used by `query()`, `@QueryMethod` and the raw query builder. */
    public abstract query<T = any>(query: string, options?: AdapterQueryOptions): Promise<T>;

    /** Fetches a single record matching `where`. */
    public abstract findOne(where?: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<T | null>;

    /** Fetches a single record matching `where`. Should throw a `VSRepoAdapterError` (`NOT_FOUND`) if none is found. */
    public abstract findOneOrThrow(where?: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<T>;

    /** Fetches all records matching `where`. */
    public abstract findMany(where?: VSRepoWhere<T>, options?: AdapterMethodOptions<T>): Promise<T[]>;

    /** Creates or updates (upsert) a single record. */
    public abstract save(obj: DeepPartial<T>, options?: SimpleAdapterMethodOptions<T>): Promise<T>;

    /** Creates or updates (upsert) multiple records in a single operation. */
    public abstract saveMany(objs: DeepPartial<T>[], options?: SimpleAdapterMethodOptions<T>): Promise<T[]>;

    /** Creates a single record. */
    public abstract create(obj: DeepPartial<T>, options?: SimpleAdapterMethodOptions<T>): Promise<T>;

    /** Creates multiple records in a single operation. */
    public abstract createMany(
        objs: DeepPartial<T>[],
        options?: WithIgnoreConflicts<RestrictAdapterMethodOptions<T>>,
    ): Promise<CountResult>;

    /** Creates multiple records in a single operation, returning the created records. */
    public abstract createManyReturning(
        objs: DeepPartial<T>[],
        options?: WithIgnoreConflicts<SimpleAdapterMethodOptions<T>>,
    ): Promise<T[]>;

    /** Deletes a single record matching `where`. */
    public abstract delete(where: VSRepoWhere<T>, options?: SimpleAdapterMethodOptions<T>): Promise<T>;

    /** Deletes every record matching `where`, returning the count of affected rows. */
    public abstract deleteMany(where: VSRepoWhere<T>, options?: RestrictAdapterMethodOptions<T>): Promise<CountResult>;

    /** Deletes every record matching `where`, returning the deleted records. */
    public abstract deleteManyReturning(where: VSRepoWhere<T>, options?: SimpleAdapterMethodOptions<T>): Promise<T[]>;

    /** Updates a single record matching `where`. */
    public abstract update(
        where: VSRepoWhere<T>,
        obj: DeepPartial<T>,
        options?: SimpleAdapterMethodOptions<T>,
    ): Promise<T>;

    /** Updates every record matching `where`, returning the count of affected rows. */
    public abstract updateMany(
        where: VSRepoWhere<T>,
        obj: DeepPartial<T>,
        options?: RestrictAdapterMethodOptions<T>,
    ): Promise<CountResult>;

    /** Updates every record matching `where`, returning the updated records. */
    public abstract updateManyReturning(
        where: VSRepoWhere<T>,
        obj: DeepPartial<T>,
        options?: SimpleAdapterMethodOptions<T>,
    ): Promise<T[]>;

    /** Returns the number of records matching `where`. */
    public abstract count(where?: VSRepoWhere<T>, options?: RestrictAdapterMethodOptions<T>): Promise<number>;

    /** Checks whether at least one record matching `where` exists. */
    public abstract exists(where?: VSRepoWhere<T>, options?: RestrictAdapterMethodOptions<T>): Promise<boolean>;

    /** Creates a record if none matches `where`, otherwise updates it. */
    public abstract upsert(
        where: VSRepoWhere<T>,
        create: DeepPartial<T>,
        update: DeepPartial<T>,
        options?: SimpleAdapterMethodOptions<T>,
    ): Promise<T>;

    /** Atomically adds `value` to `field` of the record matching `where`. */
    public abstract incrementOne<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: SimpleAdapterMethodOptions<T>,
    ): Promise<T>;

    /** Atomically subtracts `value` from `field` of the record matching `where`. */
    public abstract decrementOne<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: SimpleAdapterMethodOptions<T>,
    ): Promise<T>;

    /** Atomically multiplies `field` of the record matching `where` by `value`. */
    public abstract multiplyOne<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: SimpleAdapterMethodOptions<T>,
    ): Promise<T>;

    /** Atomically divides `field` of the record matching `where` by `value`. */
    public abstract divideOne<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: SimpleAdapterMethodOptions<T>,
    ): Promise<T>;

    /** Same as `incrementOne`, for every record matching `where`. Returns the count of affected rows. */
    public abstract incrementMany<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: RestrictAdapterMethodOptions<T>,
    ): Promise<CountResult>;

    /** Same as `decrementOne`, for every record matching `where`. Returns the count of affected rows. */
    public abstract decrementMany<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: RestrictAdapterMethodOptions<T>,
    ): Promise<CountResult>;

    /** Same as `multiplyOne`, for every record matching `where`. Returns the count of affected rows. */
    public abstract multiplyMany<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: RestrictAdapterMethodOptions<T>,
    ): Promise<CountResult>;

    /** Same as `divideOne`, for every record matching `where`. Returns the count of affected rows. */
    public abstract divideMany<K extends NumericKeys<T>>(
        field: K,
        value: NonNullable<T[K]>,
        where: VSRepoWhere<T>,
        options?: RestrictAdapterMethodOptions<T>,
    ): Promise<CountResult>;

    /** Returns the sum of `field` across the records matching `where`, or `null` if none match. */
    public abstract sum(
        field: NumericKeys<T>,
        where?: VSRepoWhere<T>,
        options?: RestrictAdapterMethodOptions<T>,
    ): Promise<number | null>;

    /** Returns the average of `field` across the records matching `where`, or `null` if none match. */
    public abstract average(
        field: NumericKeys<T>,
        where?: VSRepoWhere<T>,
        options?: RestrictAdapterMethodOptions<T>,
    ): Promise<number | null>;

    /** Returns the minimum of `field` across the records matching `where`, or `null` if none match. */
    public abstract min(
        field: NumericKeys<T>,
        where?: VSRepoWhere<T>,
        options?: RestrictAdapterMethodOptions<T>,
    ): Promise<number | null>;

    /** Returns the maximum of `field` across the records matching `where`, or `null` if none match. */
    public abstract max(
        field: NumericKeys<T>,
        where?: VSRepoWhere<T>,
        options?: RestrictAdapterMethodOptions<T>,
    ): Promise<number | null>;

    /** Optional. Returns the primary key name, so users don't have to set `pkName` in the `VSRepository` options. */
    public getPkName?(): string;

    /**
     * Returns the placeholder the database/driver expects for the parameter at `index` (0-based position
     * in `args`), e.g. `$1` for Postgres or `?` for SQLite/MySQL. Used to compile `VSSql` fragments,
     * `vsPlaceholders` strings and the raw query builder.
     */
    public abstract getPlaceholder(index: number): string;
}

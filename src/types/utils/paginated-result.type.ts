/**
 * Result of `VSQueryBuilder.getResultAndCount()`.
 *
 * @publicApi
 */
export type PaginatedResult<T> = {
    /** The page of records. */
    result: T;
    /** Total of records matching the filter, ignoring pagination. */
    count: number;
};

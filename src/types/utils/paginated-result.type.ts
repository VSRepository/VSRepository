/**
 * Result of `VSRepository.findAndCount()`, of the `findAndCountBy…`/`findAndCountWhere…` dynamic methods
 * and of `VSQueryBuilder.getResultAndCount()`.
 *
 * @publicApi
 */
export type PaginatedResult<T> = {
    /** The page of records. */
    result: T;
    /** Total of records matching the filter, ignoring pagination. */
    count: number;
};

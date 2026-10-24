/**
 * Adds the `ignoreConflicts` option to `T`: when `true`, rows that violate a unique constraint are skipped instead of raising an error.
 *
 * @publicApi
 */
export type WithIgnoreConflicts<T> = T & { ignoreConflicts?: boolean };

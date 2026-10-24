import { GetPlaceholderFn } from "../../types/utils/get-placeholder-fn.type.js";

/**
 * VSRepository's own placeholder: `?1`, `?2`, ...
 *
 * @publicApi
 */
export const getVsPlaceholder: GetPlaceholderFn = index => `?${index + 1}`;
/**
 * Postgres-style placeholder: `$1`, `$2`, ...
 *
 * @publicApi
 */
export const getPostgresPlaceholder: GetPlaceholderFn = index => `$${index + 1}`;
/**
 * Alias to `getPostgresPlaceholder`
 *
 * @publicApi
 */
export const getCockroachPlaceholder = getPostgresPlaceholder;
/**
 * Positional placeholder: always `?`, regardless of the index.
 *
 * @publicApi
 */
export const getSqlitePlaceholder: GetPlaceholderFn = _index => "?";
/**
 * Alias to `getSqlitePlaceholder`
 *
 * @publicApi
 */
export const getMySqlPlaceholder = getSqlitePlaceholder;
/**
 * SQL Server-style placeholder: `@P1`, `@P2`, ...
 *
 * @publicApi
 */
export const getSqlServerPlaceholder: GetPlaceholderFn = index => `@P${index + 1}`;

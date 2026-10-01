import { GetPlaceholderFn } from "../../types/utils/get-placeholder-fn.type.js";

/**
 * @publicApi
 */
export const getVsPlaceholder: GetPlaceholderFn = index => `?${index + 1}`;
/**
 * @publicApi
 */
export const getPostgresPlaceholder: GetPlaceholderFn = index => `$${index + 1}`;
/**
 * Alias to `getPostgresPlaceholder`
 * @publicApi
 */
export const getCockroachPlaceholder = getPostgresPlaceholder;
/**
 * @publicApi
 */
export const getSqlitePlaceholder: GetPlaceholderFn = _index => "?";
/**
 * Alias to `getSqlitePlaceholder`
 * @publicApi
 */
export const getMySqlPlaceholder = getSqlitePlaceholder;
/**
 * @publicApi
 */
export const getSqlServerPlaceholder: GetPlaceholderFn = index => `@P${index + 1}`;

/**
 * Visibility mode for records managed by soft-delete.
 *
 * - `"active"` — returns only non-deleted records (default).
 * - `"removed"` — returns only deleted records.
 * - `"all"` — returns all records, regardless of their deletion status.
 *
 * Only has effect when softDelete is configured on the repository.
 *
 * @publicApi
 */
export type SeeMode = "active" | "removed" | "all";

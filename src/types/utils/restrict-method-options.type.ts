import { VSRepoOrmTypes } from "../vsrepo/vsrepo-orm-types.type.js";
import { MethodOptions } from "./methods-options.type.js";

/**
 * Narrowed variant of {@link MethodOptions} exposing only `db` and `see`.
 *
 * Used by base methods that don't shape/return an `Entity` — count-like
 * operations (`total`, `has`, `sum`, `average`, `min`, `max`) and
 * batch-delete-like operations (`removeList`, `softRemoveList`,
 * `restoreList`) — where `select`/`relations` (which only make sense when
 * an `Entity` is being returned) don't apply.
 *
 * @publicApi
 */
export type RestrictMethodOptions<T, O extends VSRepoOrmTypes = VSRepoOrmTypes> = Pick<
    MethodOptions<T, O>,
    "db" | "see"
>;

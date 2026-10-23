import { VSRepoOrmTypes } from "../vsrepo/vsrepo-orm-types.type.js";
import { MethodOptions } from "./methods-options.type.js";

/**
 * Narrowed variant of `MethodOptions` exposing only `db` and `see`.
 *
 * @publicApi
 */
export type RestrictMethodOptions<T, O extends VSRepoOrmTypes = VSRepoOrmTypes> = Pick<
    MethodOptions<T, O>,
    "db" | "see"
>;

import { VSRepoOrmTypes } from "../vsrepo/vsrepo-orm-types.type.js";
import { MethodOptions } from "./methods-options.type.js";

/**
 * @publicApi
 */
export type SimpleMethodOptions<T, K extends VSRepoOrmTypes = VSRepoOrmTypes> = Omit<
    MethodOptions<T, K>,
    "pagination" | "order"
>;

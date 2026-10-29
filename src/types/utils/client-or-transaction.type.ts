import { VSRepoOrmTypes } from "../vsrepo/vsrepo-orm-types.type.js";

/**
 * Database client or transaction of the given ORM types.
 *
 * @publicApi
 */
export type ClientOrTransaction<T extends VSRepoOrmTypes> = T["dbClient"] | T["dbTransaction"];

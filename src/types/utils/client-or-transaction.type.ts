import { VSRepoOrmTypes } from "../vsrepo/vsrepo-orm-types.type.js";

/**
 * @publicApi
 */
export type ClientOrTransaction<T extends VSRepoOrmTypes> = T["dbClient"] | T["dbTransaction"];

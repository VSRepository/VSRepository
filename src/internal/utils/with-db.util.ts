import { ClientOrTransaction } from "../../types/utils/client-or-transaction.type.js";
import { VSRepoOrmTypes } from "../../types/vsrepo/vsrepo-orm-types.type.js";
import { DbArg } from "./db-arg.util.js";

/**
 * Wraps a client or transaction so it can be passed as the last argument of a `@QueryMethod`,
 * running that call on `db` instead of the repository's default client.
 *
 * @example
 * ```typescript
 * await userRepository.transaction(async tx => {
 *     await userRepository.findByEmail("joao@email.com", withDb(tx));
 * });
 * ```
 *
 * @publicApi
 */
export function withDb<T extends VSRepoOrmTypes = VSRepoOrmTypes>(db: ClientOrTransaction<T>): DbArg<T> {
    return new DbArg(db);
}

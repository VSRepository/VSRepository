import { ClientOrTransaction } from "../../types/utils/client-or-transaction.type.js";
import { VSRepoOrmTypes } from "../../types/vsrepo/vsrepo-orm-types.type.js";
import { DbArg } from "./db-arg.util.js";

/**
 * Wraps a database client or transaction so it can be passed as the
 * trailing argument of a `@QueryMethod`,  running that call against `db`
 * instead of the repository's default client.
 *
 * @example
 * ```typescript
 * await userRepository.transaction(async (tx) => {
 *     await userRepository.findByEmailAndRole("joao@email.com", "admin", withDb(tx));
 * });
 * ```
 *
 * @publicApi
 */
export function withDb<T extends VSRepoOrmTypes = VSRepoOrmTypes>(db: ClientOrTransaction<T>): DbArg<T> {
    return new DbArg(db);
}

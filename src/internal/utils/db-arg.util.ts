import { ClientOrTransaction } from "../../types/utils/client-or-transaction.type.js";
import { VSRepoOrmTypes } from "../../types/vsrepo/vsrepo-orm-types.type.js";

/**
 * Wraps a database client or transaction so it can be recognized, at
 * runtime, as the trailing `db` override in a `QueryArgs` spread call —
 * as opposed to a regular positional query argument. Build one with
 * `withDb` rather than constructing it directly.
 *
 * @publicApi
 */
export class DbArg<T extends VSRepoOrmTypes = VSRepoOrmTypes> {
    constructor(private readonly db: ClientOrTransaction<T>) {}

    /** Returns the wrapped database client or transaction. */
    getDb(): ClientOrTransaction<T> {
        return this.db;
    }
}

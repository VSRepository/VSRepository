import { ClientOrTransaction } from "../../types/utils/client-or-transaction.type.js";
import { VSRepoOrmTypes } from "../../types/vsrepo/vsrepo-orm-types.type.js";

/**
 * Marks the `db` override passed as the last argument of a `@QueryMethod`.
 * Create it with `withDb` instead of instantiating it directly.
 *
 * @publicApi
 */
export class DbArg<T extends VSRepoOrmTypes = VSRepoOrmTypes> {
    /** @param db Client or transaction to wrap. */
    constructor(private readonly db: ClientOrTransaction<T>) {}

    /** Returns the wrapped database client or transaction. */
    getDb(): ClientOrTransaction<T> {
        return this.db;
    }
}

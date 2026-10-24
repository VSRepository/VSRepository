import { ClientOrTransaction } from "../utils/client-or-transaction.type.js";
import { VSRepoOrmTypes } from "./vsrepo-orm-types.type.js";

/**
 * Options accepted by `VSRepository.query()`.
 *
 * @publicApi
 */
export type VSRepoQueryOptions<T extends VSRepoOrmTypes = VSRepoOrmTypes> = {
    /** Positional parameters injected into the SQL placeholders — the placeholder syntax depends on the database/driver behind your adapter. */
    args?: any[];
    /** Database client or transaction to run this query in, instead of the repository's default client. */
    db?: ClientOrTransaction<T>;
    /**
     * Whether this is a modifying statement (`INSERT`/`UPDATE`/`DELETE`).
     * @default false
     */
    modifying?: boolean;
    /**
     * When `true`, an array result is replaced by its first element (`null` if empty).
     * Useful for queries known to return at most one row.
     *
     * @default false
     */
    singleResult?: boolean;
};

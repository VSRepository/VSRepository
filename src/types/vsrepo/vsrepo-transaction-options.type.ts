import { VSRepoIsolationLevel } from "../../internal/enums/vsrepo-isolation-level.enum.js";

/**
 * Options accepted by `VSRepository.transaction()`.
 *
 * @publicApi
 */
export type VSRepoTransactionOptions = {
    /** Isolation level to use for the transaction. Defaults to the underlying ORM's default. */
    isolationLevel?: VSRepoIsolationLevel | `${VSRepoIsolationLevel}`;
    /** Maximum time (in ms) the transaction is allowed to run before being aborted. */
    timeoutMs?: number;
};

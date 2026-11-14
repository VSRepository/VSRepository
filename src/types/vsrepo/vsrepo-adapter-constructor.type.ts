import { VSRepoAdapter } from "../../VSRepoAdapter.js";
import { Class } from "../utils/class.type.js";
import { VSRepoTransactionOptions } from "./vsrepo-transaction-options.type.js";

/**
 * Constructor type for a `VSRepoAdapter` implementation.
 *
 * @publicApi
 */
export interface VSRepoAdapterConstructor extends Class<VSRepoAdapter> {
    /** Configures adapter-specific defaults shared by adapter instances. */
    setGlobalConfig?(config: unknown): void;

    /**
     * Opens a transaction directly from a database client when the underlying ORM supports it.
     *
     * Adapters should expose this method when their ORM can start a transaction directly from a
     * `dbClient`.
     */
    execInTransaction?<R>(dbClient: any, fn: (tx: any) => Promise<R>, options?: VSRepoTransactionOptions): Promise<R>;
}

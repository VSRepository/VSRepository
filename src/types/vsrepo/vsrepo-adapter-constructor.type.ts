import { VSRepoAdapter } from "../../VSRepoAdapter.js";
import { Class } from "../utils/class.type.js";

/**
 * Constructor type for a `VSRepoAdapter` implementation.
 *
 * @publicApi
 */
export interface VSRepoAdapterConstructor extends Class<VSRepoAdapter> {
    /** Configures adapter-specific defaults shared by adapter instances. */
    setGlobalConfig?(config: unknown): void;
}

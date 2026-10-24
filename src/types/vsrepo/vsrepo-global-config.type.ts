import { VSLogLevel } from "../../internal/enums/vs-log-level.enum.js";

/**
 * Defaults shared by every repository, set with `VSRepository.setGlobalConfig()`.
 * Per-repository options take precedence.
 *
 * @publicApi
 */
export type VSRepoGlobalConfig = {
    /** Soft-delete field used by `@EnableSoftDelete` when it doesn't specify one. */
    softDeleteField?: string;
    /** Default for the `logLevel` option. */
    logLevel?: VSLogLevel;
    /** Default for the `lazyDynamicMethods` option. */
    lazyDynamicMethods?: boolean;
    /** Default for the `vsPlaceholders` option. */
    vsPlaceholders?: boolean;
};

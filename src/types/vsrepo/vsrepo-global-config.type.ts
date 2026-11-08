import { VSLogLevel } from "../../internal/enums/vs-log-level.enum.js";
import { MergeConfig } from "../utils/merge-config.type.js";

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
    /**
     * Default `undefinedBehavior`/`nullBehavior` used by `merge()`. The `mergeConfig` given in a repository's
     * options (and the one given in a `merge()` call) is **merged** over this one, instead of replacing it.
     * `fields` can't be set globally, since it depends on the entity.
     */
    mergeConfig?: Pick<MergeConfig<any>, "undefinedBehavior" | "nullBehavior">;
};

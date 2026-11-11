import { VSLogLevel } from "../../internal/enums/vs-log-level.enum.js";
import { MergeConfig } from "../utils/merge-config.type.js";

/**
 * Defaults shared by every repository, set with `VSRepository.setGlobalConfig()`. They act as the
 * fallback value for each corresponding per-repository option, so an option set in a repository's
 * own config always wins over the global one. Only repositories created after the call are affected.
 *
 * @publicApi
 */
export type VSRepoGlobalConfig = {
    /**
     * Name of the soft-delete field used by `@EnableSoftDelete` decorators that don't specify one.
     * When the decorator passes its own field name, that name takes precedence.
     */
    softDeleteField?: string;
    /**
     * Minimum severity of messages printed by each repository's internal logger. Suppresses every
     * message below the chosen level (see `VSLogLevel`); `VSLogLevel.NONE` disables logging.
     *
     * @default VSLogLevel.WARN
     */
    logLevel?: VSLogLevel;
    /**
     * When `true`, repositories skip resolving `@DynamicMethod`/`@QueryMethod` fields in the
     * constructor, so the subclass must call `resolveDynamicMethods()` itself.
     *
     * @default false
     */
    lazyDynamicMethods?: boolean;
    /**
     * When `true` (or omitted), raw SQL strings given to `VSRepository.query()` and `@QueryMethod`
     * use VSRepository's own positional placeholders (`?1`, `?2`, ...; 1-based, an index can be
     * repeated) instead of the database's native syntax.
     *
     * @default true
     */
    vsPlaceholders?: boolean;
    /**
     * Default behavior `merge()` applies to source fields that are `undefined` or `null`, combined with
     * the stored record. A repository's own `mergeConfig` and the one given to a `merge()` call are
     * **merged** over this one (not replacing it), so only the properties they set are overridden.
     *
     * - `undefinedBehavior`: `"ignore"` skips `undefined` source fields (target keeps its value, default);
     *   `"keep"` writes the `undefined` over the target.
     * - `nullBehavior`: `"keep"` writes the `null` over the target (default); `"ignore"` skips `null` source fields.
     *
     * Per-field strategies (`fields`) can't be set globally, since they depend on the entity.
     */
    mergeConfig?: Pick<MergeConfig<any>, "undefinedBehavior" | "nullBehavior">;
};

import { VSRepoAdapter } from "../../VSRepoAdapter.js";
import { VSLogLevel } from "../../internal/enums/vs-log-level.enum.js";
import { KeysOfType } from "../utils/keys-of-type.type.js";
import { Ordering } from "../utils/ordering.type.js";

/**
 * Configuration passed to the `VSRepository` constructor.
 *
 * @template T Entity type managed by the repository.
 * @template K Type of the entity's primary key value.
 *
 * @publicApi
 */
export type VSRepoOptions<T, K> = {
    /** Adapter that translates the repository's operations into calls against the underlying ORM/database. */
    adapter: VSRepoAdapter<T>;
    /** Name of the field that represents the entity's primary key (PK). */
    pkName?: KeysOfType<T, K>;
    /**
     * Name of the field used for soft-delete.
     *
     * When configured, enables the `softRemove`, `softRemoveList`, `restore`,
     * and `restoreList` methods.
     */
    softRemoveKey?: keyof T;
    /** Minimum severity of messages printed by the repository's internal logger. Defaults to `VSLogLevel.WARN`. */
    logLevel?: VSLogLevel;
    /**
     * Duration (in ms) above which a finished operation is logged as WARN
     * instead of DEBUG, flagging potentially slow queries. Defaults to 300ms.
     *
     * Pass `false` to disable slow-operation warnings entirely.
     * Pass `true` to use the default 300ms threshold explicitly.
     */
    logSlowThresholdMs?: number | boolean;
    /** Default ordering automatically applied to queries that accept `order`, unless the call overrides it. */
    defaultOrdering?: Ordering<T>;
    /**
     * When `true`, postpones resolving every `@DynamicMethod`/`@QueryMethod`
     * field of the subclass: the constructor skips that step, and the
     * subclass itself must call the inherited `resolveDynamicMethods()` to
     * make those methods available.
     *
     * @default false
     */
    lazyDynamicMethods?: boolean;
    /**
     * When `true`, raw SQL strings passed to `VSRepository.query()` and
     * `@QueryMethod` stop using your database's native placeholder syntax
     * and instead use VSRepository's own agnostic, positional placeholders —
     * `?1`, `?2`, ... (1-based, Spring Data JPA style). The same index may be
     * repeated (`?1 ... ?1`) to reuse the same argument more than once.
     *
     * Compiled via `adapter.getPlaceholder()`, so the adapter must implement
     * it — the constructor throws a `VSRepoError` if it's enabled and the
     * adapter doesn't.
     *
     * This is independent of passing a `VSSql` fragment directly to
     * `VSRepository.query()`, which always requires `getPlaceholder()`
     * regardless of this option.
     *
     * @default false
     */
    vsPlaceholders?: boolean;
};

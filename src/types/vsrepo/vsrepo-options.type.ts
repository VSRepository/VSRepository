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
    /** Minimum severity of messages printed by the repository's internal logger. Defaults to `VSLogLevel.WARN`. */
    logLevel?: VSLogLevel;
    /** Default ordering automatically applied to queries that accept `order`, unless the call overrides it. */
    defaultOrdering?: Ordering<T>;
    /**
     * When `true`, the constructor skips resolving `@DynamicMethod`/`@QueryMethod` fields and the
     * subclass must call `resolveDynamicMethods()` itself.
     *
     * @default false
     */
    lazyDynamicMethods?: boolean;
    /**
     * When `true` (or omitted), raw SQL strings given to `VSRepository.query()` and `@QueryMethod` use
     * VSRepository's own positional placeholders (`?1`, `?2`, ...; 1-based, an index can be repeated)
     * instead of the database's native syntax.
     *
     * @default true
     */
    vsPlaceholders?: boolean;
};

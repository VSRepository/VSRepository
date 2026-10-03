/**
 * Minimum severity a message must have to be printed by the repository's
 * internal logger, configured via `VSRepoOptions.logLevel`. Levels are
 * ordered from most to least verbose; setting a level suppresses all
 * messages below it.
 *
 * @publicApi
 */
export enum VSLogLevel {
    /** Verbose internal details, including every resolved query. */
    DEBUG,
    /** High-level lifecycle events, such as repository initialization. */
    INFO,
    /** Recoverable issues. */
    WARN,
    /** Failures raised while executing an operation. */
    ERROR,
    /** Completely disables logs */
    NONE,
}

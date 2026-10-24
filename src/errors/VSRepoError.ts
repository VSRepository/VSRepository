import { VSRepoErrorType } from "../internal/enums/vsrepo-error-type.enum.js";

/**
 * Base error thrown by VSRepository for any invalid usage, configuration, or
 * runtime failure — decorator misuse, invalid method options, resolver
 * failures, and base-method guard clauses.
 *
 * @publicApi
 */
export class VSRepoError extends Error {
    /**
     * @param message Description of the failure. It is prefixed with `[VSRepository] Error:`.
     * @param type Category of the error. See `VSRepoErrorType`.
     * @param cause Optional root cause.
     */
    constructor(
        message: string,
        public readonly type: VSRepoErrorType,
        cause?: unknown,
    ) {
        super(`[VSRepository] Error: ${message}`, { cause });
        this.name = "VSRepoError";
    }
}

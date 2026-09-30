import { VSRepoErrorType } from "../internal/enums/vsrepo-error-type.enum.js";

/**
 * Base error thrown by VSRepository for any invalid usage, configuration, or
 * runtime failure — decorator misuse, invalid method options, resolver
 * failures, and base-method guard clauses.
 *
 * @publicApi
 */
export class VSRepoError extends Error {
    constructor(
        message: string,
        /** Category of the error. See `VSRepoErrorType` for the full list. */
        public readonly type: VSRepoErrorType,
        cause?: unknown,
    ) {
        super(`[VSRepository] Error: ${message}`, { cause });
        this.name = "VSRepoError";
    }
}

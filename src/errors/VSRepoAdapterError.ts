import { AdapterErrorCode } from "../internal/enums/adapter-error-code.enum.js";
import { VSRepoErrorType } from "../internal/enums/vsrepo-error-type.enum.js";
import { VSRepoError } from "./VSRepoError.js";

/**
 * Error raised when a `VSRepoAdapter` fails while talking to the ORM/database. Carries an
 * adapter-agnostic `AdapterErrorCode` and the original error, so callers don't depend on any
 * specific ORM's error shape.
 *
 * @publicApi
 */
export class VSRepoAdapterError extends VSRepoError {
    /**
     * @param message - Human-readable description of the adapter failure.
     * @param code - Stable, adapter-agnostic code classifying the failure.
     * @param originalError - The raw error (or `null`/`undefined`) thrown by the
     * underlying ORM/database driver.
     * @param cause - Optional root cause to chain, e.g. the originating exception.
     */
    constructor(
        message: string,
        public readonly code: AdapterErrorCode,
        public readonly originalError: unknown,
        cause?: unknown,
    ) {
        super(message, VSRepoErrorType.ADAPTER, cause);
        this.name = "VSRepoAdapterError";
    }
}

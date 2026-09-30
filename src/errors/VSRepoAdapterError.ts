import { AdapterErrorCode } from "../internal/enums/adapter-error-code.enum.js";
import { VSRepoErrorType } from "../internal/enums/vsrepo-error-type.enum.js";
import { VSRepoError } from "./VSRepoError.js";

/**
 * Error raised when a `VSRepoAdapter` fails while talking to the underlying
 * ORM/database. Carries a stable, adapter-agnostic {@link AdapterErrorCode} plus
 * the original error thrown by the adapter, so callers can react to failures
 * without depending on any specific ORM's error shape.
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

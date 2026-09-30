import { Ordering } from "../utils/ordering.type.js";

/**
 * Options accepted by the `@DynamicMethod` decorator.
 *
 * @template T Entity type the decorated method operates on.
 *
 * @publicApi
 */
export type DynamicMethodOptions<T = any> = {
    /** Redirects the method's logic to another valid dynamic-method pattern. Useful for method names that don't follow the naming convention. */
    proxyTo?: string;
    /** Fixed ordering automatically injected into the query, overriding the repository's `defaultOrdering`. */
    injectOrdering?: Ordering<T>;
};

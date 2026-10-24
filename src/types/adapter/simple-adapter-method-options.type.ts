import { AdapterMethodOptions } from "./adapter-method-options.type.js";

/**
 * Adapter options without `pagination` and `order`.
 *
 * @publicApi
 */
export type SimpleAdapterMethodOptions<T> = Omit<AdapterMethodOptions<T>, "pagination" | "order">;

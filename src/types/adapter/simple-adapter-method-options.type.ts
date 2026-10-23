import { AdapterMethodOptions } from "./adapter-method-options.type.js";

/**
 * @publicApi
 */
export type SimpleAdapterMethodOptions<T> = Omit<AdapterMethodOptions<T>, "pagination" | "order">;

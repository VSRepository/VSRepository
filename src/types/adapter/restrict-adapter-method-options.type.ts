import { AdapterMethodOptions } from "./adapter-method-options.type.js";

/**
 * @publicApi
 */
export type RestrictAdapterMethodOptions<T> = Pick<AdapterMethodOptions<T>, "db">;

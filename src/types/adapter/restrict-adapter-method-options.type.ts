import { AdapterMethodOptions } from "./adapter-method-options.type.js";

/**
 * Adapter options with only `db`.
 *
 * @publicApi
 */
export type RestrictAdapterMethodOptions<T> = Pick<AdapterMethodOptions<T>, "db">;

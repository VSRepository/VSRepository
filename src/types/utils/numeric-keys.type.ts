import { NumericLike } from "./numeric-like.type.js";

/**
 * Extracts the keys of `T` whose (non-nullable) value type is assignable to
 * `NumericLike` — i.e. the fields eligible as the `field` argument of
 * `increment`/`decrement`/`multiply`/`divide`/`sum`/`average`/`min`/`max`.
 *
 * @publicApi
 */
export type NumericKeys<T> = {
    [P in keyof T]: NonNullable<T[P]> extends NumericLike ? P : never;
}[keyof T];

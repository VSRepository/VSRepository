import { NumericLike } from "./numeric-like.type.js";

/**
 * Extracts the keys of `T` whose (non-nullable) value type is assignable to
 * {@link NumericLike} — i.e. the fields eligible as the `field` argument of
 * `increment`/`decrement`/`multiply`/`divide`/`sum`/`average`/`min`/`max`.
 *
 * Nullable/optional numeric fields (e.g. `number | null`) ARE included —
 * the `null`/`undefined` part is stripped before the check, it isn't a
 * reason to exclude the field. This means a field that is currently `NULL`
 * in the database can be targeted; be aware that in standard SQL, arithmetic
 * against a `NULL` value (`NULL + 5`) itself stays `NULL` — this type only
 * governs what compiles, not the row's runtime value.
 *
 * @example
 * ```typescript
 * type Product = { id: string; price: Decimal; stock: number | null; name: string };
 * type Numeric = NumericKeys<Product>; // "price" | "stock"
 * ```
 *
 * @publicApi
 */
export type NumericKeys<T> = {
    [P in keyof T]: NonNullable<T[P]> extends NumericLike ? P : never;
}[keyof T];

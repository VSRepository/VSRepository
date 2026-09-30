import { DecimalLike } from "./decimal-like.type.js";

/**
 * Union of value types accepted as "numeric" by the atomic
 * (`increment`/`decrement`/`multiply`/`divide`) and aggregate
 * (`sum`/`average`/`min`/`max`) operations: a native `number`, a native
 * `bigint`, or a {@link DecimalLike} object.
 *
 * @publicApi
 */
export type NumericLike = number | bigint | DecimalLike;

import { DecimalLike } from "./decimal-like.type.js";

/**
 * Types treated as scalar (non-relation) values when walking an entity's shape.
 *
 * @publicApi
 */
export type Primitive = string | number | boolean | bigint | symbol | undefined | null | Date | DecimalLike;

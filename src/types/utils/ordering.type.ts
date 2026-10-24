import { Primitive } from "./primitive.type.js";

/**
 * Sort direction accepted by `Ordering`. Case-insensitive: both the
 * lowercase (`"asc"`/`"desc"`) and uppercase (`"ASC"`/`"DESC"`) forms are valid.
 *
 * @publicApi
 */
export type SortDirection = "asc" | "desc" | "ASC" | "DESC";

/**
 * Ordering shape for a single level of an entity's fields.
 *
 * @publicApi
 */
export type OrderByField<T> = {
    [P in keyof T as NonNullable<T[P]> extends Primitive ? P : never]?: SortDirection;
};

/**
 * Ordering accepted by methods that support `order`: a single object or a list of them,
 * applied in the order declared.
 *
 * @example
 * ```typescript
 * const order: Ordering<User> = [{ name: "asc" }, { createdAt: "desc" }];
 * ```
 *
 * @publicApi
 */
export type Ordering<T> = OrderByField<T> | OrderByField<T>[];

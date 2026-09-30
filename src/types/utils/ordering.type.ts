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
 * @template T Entity type being ordered.
 *
 * @publicApi
 */
export type OrderByField<T> = {
    [P in keyof T as NonNullable<T[P]> extends Primitive ? P : never]?: SortDirection;
};

/**
 * Ordering accepted by repository methods that support `order`, such as `getAll` or a dynamic method with `Ordered`.
 *
 * Can be a single ordering object or a list of chained orderings, applied in
 * the order they're declared.
 *
 * @template T Entity type being ordered.
 *
 * @example
 * ```typescript
 * const order: Ordering<User> = { createdAt: "desc" };
 * const chained: Ordering<User> = [{ name: "asc" }, { createdAt: "desc" }];
 * ```
 *
 * @publicApi
 */
export type Ordering<T> = OrderByField<T> | OrderByField<T>[];

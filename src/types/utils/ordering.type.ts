import { Primitive } from "./primitive.type.js";

/**
 * Sort direction accepted by `Ordering`. Case-insensitive: both the
 * lowercase (`"asc"`/`"desc"`) and uppercase (`"ASC"`/`"DESC"`) forms are valid.
 *
 * @publicApi
 */
export type SortDirection = "asc" | "desc" | "ASC" | "DESC";

/**
 * Ordering shape for an entity's fields. Primitive fields take a
 * `SortDirection`; to-one relations take a nested ordering of the related entity.
 *
 * @publicApi
 */
export type OrderByField<T, Depth extends unknown[] = []> = {
    [P in keyof T]?: NonNullable<T[P]> extends Primitive
        ? SortDirection
        : NonNullable<T[P]> extends readonly unknown[]
          ? never
          : Depth["length"] extends 3 // limite de profundidade
            ? never
            : OrderByField<NonNullable<T[P]>, [...Depth, unknown]>;
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

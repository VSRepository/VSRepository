import { Primitive } from "../utils/primitive.type.js";

/**
 * Operators available to filter a single scalar field's value.
 *
 * The set of operators offered narrows based on `V`'s type: numbers and dates
 * additionally get `between`; strings additionally get `contains`, `startsWith`,
 * `endsWith`, and `ignoreCase`; every non-boolean type additionally gets
 * `in`, `notIn`, `gt`, `gte`, `lt`, and `lte`.
 *
 * @template V Type of the field's value.
 *
 * @publicApi
 */
export type VSRepoFieldOperators<V> = {
    /** Matches records where the field equals `V`. */
    equals?: V;
    /** Negates the given value or operator object. */
    not?: V | VSRepoFieldOperators<V>;
} & (V extends number | Date
    ? {
          /** Matches records where the field is between the given `[min, max]` tuple, inclusive. */
          between?: [V, V];
      }
    : {}) &
    (V extends string
        ? {
              /** Matches records where the field contains the given substring. */
              contains?: string;
              /** Matches records where the field starts with the given substring. */
              startsWith?: string;
              /** Matches records where the field ends with the given substring. */
              endsWith?: string;
              /** Applies the string filters above case-insensitively. */
              ignoreCase?: boolean;
          }
        : {}) &
    (V extends boolean
        ? {}
        : {
              /** Matches records where the field is one of the given values. */
              in?: V[];
              /** Matches records where the field is none of the given values. */
              notIn?: V[];
              /** Matches records where the field is greater than the given value. */
              gt?: V;
              /** Matches records where the field is greater than or equal to the given value. */
              gte?: V;
              /** Matches records where the field is less than the given value. */
              lt?: V;
              /** Matches records where the field is less than or equal to the given value. */
              lte?: V;
          });

/**
 * Value accepted for a single scalar field in a `VSRepoWhere`/`VSRepoWherePlain`
 * filter: either a direct value (shorthand for `equals`) or a `VSRepoFieldOperators` object.
 *
 * @template V Type of the field's value.
 *
 * @publicApi
 */
export type VSRepoFieldWhere<V> = V | VSRepoFieldOperators<V>;

/**
 * Field-level filters for an entity, without the top-level `AND`/`OR`/`NOT`
 * logical operators (see `VSRepoWhere` for those).
 *
 * Scalar fields accept a `VSRepoFieldWhere`. To-many relation fields accept
 * `_some`/`_every`/`_none` filters, applied to the related records. To-one
 * relation fields accept `_with`/`_without` filters.
 *
 * @template T Entity type being filtered.
 *
 * @publicApi
 */
export type VSRepoWherePlain<T> = {
    [P in keyof T]?: NonNullable<T[P]> extends Primitive
        ? VSRepoFieldWhere<T[P]>
        : NonNullable<T[P]> extends Array<infer U>
          ? U extends object
              ? {
                    /** Matches records where at least one related record matches the given filter. */
                    _some?: VSRepoWherePlain<U>;
                    /** Matches records where every related record matches the given filter. */
                    _every?: VSRepoWherePlain<U>;
                    /** Matches records where no related record matches the given filter. */
                    _none?: VSRepoWherePlain<U>;
                }
              : VSRepoFieldWhere<T[P]>
          : NonNullable<T[P]> extends object
            ? {
                  /** Matches records whose related record matches the given filter. */
                  _with?: VSRepoWherePlain<NonNullable<T[P]>>;
                  /** Matches records whose related record does not match the given filter. */
                  _without?: VSRepoWherePlain<NonNullable<T[P]>>;
              }
            : VSRepoFieldWhere<T[P]>;
};

/**
 * Filter shape accepted by the `where` clause of repository/adapter methods.
 *
 * Combines `VSRepoWherePlain`'s field-level filters with the top-level
 * logical operators `AND`, `OR`, and `NOT`, each accepting either a single
 * filter object or a list of them.
 *
 * @template T Entity type being filtered.
 *
 * @publicApi
 */
export type VSRepoWhere<T> = VSRepoWherePlain<T> & {
    /** Combines multiple filters, matching records that satisfy all of them. */
    AND?: VSRepoWherePlain<T> | VSRepoWherePlain<T>[];
    /** Combines multiple filters, matching records that satisfy at least one of them. */
    OR?: VSRepoWherePlain<T> | VSRepoWherePlain<T>[];
    /** Negates one or more filters, matching records that satisfy none of them. */
    NOT?: VSRepoWherePlain<T> | VSRepoWherePlain<T>[];
};

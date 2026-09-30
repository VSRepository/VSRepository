import { Primitive } from "../utils/primitive.type.js";

/**
 * Extracts the keys of `T` that represent relation fields (i.e. objects or
 * arrays of objects, as opposed to scalar/`Primitive` fields).
 *
 * @template T Entity type to inspect.
 *
 * @publicApi
 */
export type RelationKeys<T> = {
    [P in keyof T]: NonNullable<T[P]> extends Primitive
        ? never
        : NonNullable<T[P]> extends Array<infer U>
          ? NonNullable<U> extends Primitive
              ? never
              : P
          : NonNullable<T[P]> extends object
            ? P
            : never;
}[keyof T];

/**
 * Shape accepted by the `relations` option of repository/adapter methods,
 * used to eagerly load related records alongside the main result.
 *
 * Each relation field accepts either a `boolean` (load the relation as-is)
 * or a nested `VSRepoRelations` to further eager-load relations of that relation.
 *
 * @template T Entity type being queried.
 *
 * @publicApi
 */
export type VSRepoRelations<T> = {
    [P in RelationKeys<T>]?: NonNullable<T[P]> extends Array<infer U>
        ? U extends object
            ? boolean | VSRepoRelations<U>
            : boolean
        : NonNullable<T[P]> extends object
          ? boolean | VSRepoRelations<NonNullable<T[P]>>
          : boolean;
};

import { Primitive } from "../utils/primitive.type.js";

/**
 * Selection shape accepted by the `select` option of repository/adapter methods.
 *
 * Scalar fields accept a `boolean`; relation fields accept either a `boolean`
 * (select the relation with all of its own scalar fields) or a nested
 * `VSRepoSelect` to further restrict which fields of the relation are returned.
 *
 * @template T Entity type being selected from.
 *
 * @publicApi
 */
export type VSRepoSelect<T> = {
    [P in keyof T]?: NonNullable<T[P]> extends Primitive
        ? boolean
        : NonNullable<T[P]> extends Array<infer U>
          ? U extends Primitive
              ? boolean
              : VSRepoSelect<U> | boolean
          : NonNullable<T[P]> extends object
            ? VSRepoSelect<NonNullable<T[P]>> | boolean
            : boolean;
};

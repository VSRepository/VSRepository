import { CollectionLike } from "./collection-like.type.js";
import { Primitive } from "./primitive.type.js";
import { ReferenceLike } from "./reference-like.type.js";

/**
 * Item type of a `CollectionLike`.
 */
export type CollectionItem<C> = C extends { getItems(): readonly (infer U)[] } ? U : never;

/**
 * Wrapped type of a `ReferenceLike`.
 */
export type ReferenceValue<R> = R extends { unwrap(): infer T } ? Exclude<T, undefined> : never;

/**
 * The wrapped type of a `ReferenceLike` field, keeping the nullability of the field itself
 * (`Ref<User> | null` gives `User | null`). Any other field type is returned untouched.
 * It distributes over unions, so it also works on `T[K]` when `K` is a union of keys.
 */
export type UnwrapReference<F> = F extends CollectionLike ? F : F extends ReferenceLike ? ReferenceValue<F> : F;

/** Type of the items of a list-like field (`CollectionLike<U>`, `U[]` or `readonly U[]`), without `null`/`undefined`. */
type ListItem<L> =
    NonNullable<L> extends CollectionLike
        ? NonNullable<CollectionItem<NonNullable<L>>>
        : NonNullable<L> extends readonly (infer U)[]
          ? NonNullable<U>
          : never;

/**
 * How the core sees a field of an entity (references are unwrapped first, so `ReferenceLike<T>` is
 * classified as `T` would be):
 *
 * - `"scalar"`: a `Primitive`, an array of `Primitive`s, or anything that is not an object;
 * - `"to-many"`: an array or `CollectionLike` of non-`Primitive` items;
 * - `"to-one"`: any other object.
 */
export type FieldKind<F> =
    NonNullable<UnwrapReference<F>> extends Primitive
        ? "scalar"
        : NonNullable<UnwrapReference<F>> extends CollectionLike | readonly unknown[]
          ? ListItem<UnwrapReference<F>> extends Primitive
              ? "scalar"
              : "to-many"
          : NonNullable<UnwrapReference<F>> extends object
            ? "to-one"
            : "scalar";

/**
 * The type a field's `FieldKind` operates on:
 *
 * - `"to-many"`: the item type;
 * - `"to-one"`: the related entity type, without `null`/`undefined`;
 * - `"scalar"`: the field type itself, unwrapped when it is a `ReferenceLike` (nullability is kept).
 */
export type FieldType<F> =
    FieldKind<F> extends "to-many"
        ? ListItem<UnwrapReference<F>>
        : FieldKind<F> extends "to-one"
          ? NonNullable<UnwrapReference<F>>
          : UnwrapReference<F>;

/** Whether the field is a `CollectionLike` or a `ReferenceLike` (a wrapper the core can't merge by itself). */
export type IsWrapperField<F> = [F] extends [never]
    ? false
    : NonNullable<F> extends CollectionLike | ReferenceLike
      ? true
      : false;

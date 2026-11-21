import { CollectionLike } from "./collection-like.type.js";
import { CollectionItem, ReferenceValue } from "./field-kind.type.js";
import { Primitive } from "./primitive.type.js";
import { ReferenceLike } from "./reference-like.type.js";

/**
 * Recursively makes all properties of `T` optional, including nested objects
 * and array elements.
 *
 * @publicApi
 */
export type DeepPartial<T> =
    | T
    | (T extends CollectionLike
          ? CollectionLike<DeepPartial<CollectionItem<T>>> | DeepPartial<CollectionItem<T>>[]
          : T extends ReferenceLike
            ? [NonNullable<ReferenceValue<T>>] extends [Primitive]
                ? ReferenceValue<T>
                : ReferenceLike<DeepPartial<ReferenceValue<T>>> | DeepPartial<ReferenceValue<T>>
            : T extends readonly (infer U)[]
              ? DeepPartial<U>[]
              : T extends Primitive
                ? T
                : {
                      [K in keyof T]?: DeepPartial<T[K]>;
                  });

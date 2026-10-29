import { Primitive } from "./primitive.type.js";

/**
 * Recursively makes all properties of `T` optional, including nested objects
 * and array elements.
 *
 * @publicApi
 */
export type DeepPartial<T> =
    | T
    | (T extends Array<infer U>
          ? DeepPartial<U>[]
          : T extends Primitive
            ? T
            : {
                  [K in keyof T]?: DeepPartial<T[K]>;
              });

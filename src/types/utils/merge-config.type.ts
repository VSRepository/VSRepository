import { VSRepoOrmTypes } from "../vsrepo/vsrepo-orm-types.type.js";
import { MethodOptions } from "./methods-options.type.js";
import { Primitive } from "./primitive.type.js";

type ArrayItem<T> = NonNullable<T> extends readonly (infer U)[] ? U : never;
type IsEntity<T> = T extends Primitive ? false : T extends readonly unknown[] ? false : true;

export type MergeFieldConfig<T> =
    | {
          strategy: "custom";
          customFn: (target: T, source: T) => T;
      }
    | ([T] extends [never]
          ? {
                strategy: "concat";
                whosFirst?: "source" | "target";
            }
          : NonNullable<T> extends readonly unknown[]
            ? IsEntity<ArrayItem<T>> extends true
                ? {
                      strategy: "to-many";
                      pk: keyof ArrayItem<T> & string;
                      fields?: MergeFields<ArrayItem<T>>;
                  }
                : {
                      strategy: "concat";
                      whosFirst?: "source" | "target";
                  }
            : IsEntity<NonNullable<T>> extends true
              ? {
                    strategy: "to-one";
                    fields?: MergeFields<NonNullable<T>>;
                }
              : never);

export type MergeFields<T> = Partial<{
    [K in keyof T]: MergeFieldConfig<T[K]>;
}>;

export interface MergeConfig<T> {
    undefinedBehavior?: "keep" | "ignore";
    nullBehavior?: "keep" | "ignore";
    fields?: MergeFields<T>;
}

export interface MergeOptions<T, K extends VSRepoOrmTypes = VSRepoOrmTypes> extends MethodOptions<T, K> {
    mergeConfig?: MergeConfig<T>;
}

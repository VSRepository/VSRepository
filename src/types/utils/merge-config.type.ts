import { VSRepoOrmTypes } from "../vsrepo/vsrepo-orm-types.type.js";
import { MethodOptions } from "./methods-options.type.js";
import { Primitive } from "./primitive.type.js";

type ArrayItem<T> = NonNullable<T> extends readonly (infer U)[] ? U : never;
type IsEntity<T> = T extends Primitive ? false : T extends readonly unknown[] ? false : true;

/**
 * Merge strategy for a single field of the entity:
 *
 * - `"to-one"` — nested entity. The source object is merged **recursively** into the target
 *   object, instead of replacing it.
 * - `"to-many"` — array of entities. Items are matched between target and source through the
 *   `pk` field: matched items are merged recursively, items present only in the target are kept, and items
 *   present only in the source are appended. Items without a `pk` value can't be matched, so those from the
 *   target are kept and those from the source are appended.
 * - `"concat"` — array of scalars. Concatenates the lists, without removing duplicates.
 * - `"custom"` — available for any field. Stores whatever `customFn(target, source)` returns.
 *
 * Fields without a strategy are simply overwritten by the source value (nested objects and arrays included).
 *
 * @template T Type of the field being configured.
 *
 * @publicApi
 */
export type MergeFieldConfig<T> =
    | {
          strategy: "custom";
          /** Receives the current (target) and incoming (source) values and returns the value to store. */
          customFn: (target: T, source: T) => T;
      }
    | ([T] extends [never]
          ? {
                strategy: "concat";
                /**
                 * Which list comes first in the result: `"target"` (the stored items) or `"source"` (the incoming items).
                 *
                 * @default "target"
                 */
                whosFirst?: "source" | "target";
                /**
                 * @default false
                 */
                deduplicate?: boolean;
            }
          : NonNullable<T> extends readonly unknown[]
            ? IsEntity<ArrayItem<T>> extends true
                ? {
                      strategy: "to-many";
                      /** Field of the items that identifies them, used to match target and source items. */
                      pk: keyof ArrayItem<T> & string;
                      /**
                       * Per-field strategies applied when merging two matched items. When omitted, the source
                       * item's fields simply overwrite the target item's.
                       */
                      fields?: MergeFields<ArrayItem<T>>;
                  }
                : {
                      strategy: "concat";
                      /**
                       * Which list comes first in the result: `"target"` (the stored items) or `"source"` (the incoming items).
                       *
                       * @default "target"
                       */
                      whosFirst?: "source" | "target";
                      /**
                       * @default false
                       */
                      deduplicate?: boolean;
                  }
            : IsEntity<NonNullable<T>> extends true
              ? {
                    strategy: "to-one";
                    /**
                     * Per-field strategies applied when merging the nested entity. When omitted, the source
                     * object's fields simply overwrite the target object's.
                     */
                    fields?: MergeFields<NonNullable<T>>;
                }
              : never);

/**
 * @publicApi
 */
export type MergeFields<T> = Partial<{
    [K in keyof T]: MergeFieldConfig<T[K]>;
}>;

/**
 * Controls how `VSRepository.merge()` combines the stored record (target) with the given object (source).
 * `undefinedBehavior` and `nullBehavior` are also applied to nested
 * entities merged through `"to-one"`/`"to-many"`.
 *
 * @template T Entity type managed by the repository.
 *
 * @publicApi
 */
export interface MergeConfig<T> {
    /**
     * What to do with source fields whose value is `undefined`:
     * - `"ignore"` — skip them, so the target keeps its current value.
     * - `"keep"` — write the `undefined` over the target's value.
     *
     * @default "ignore"
     */
    undefinedBehavior?: "keep" | "ignore";
    /**
     * What to do with source fields whose value is `null`:
     * - `"keep"` — write the `null` over the target's value.
     * - `"ignore"` — skip them, so the target keeps its current value.
     *
     * @default "keep"
     */
    nullBehavior?: "keep" | "ignore";
    /**
     * Per-field merge strategies (see `MergeFieldConfig`). Fields not listed here are overwritten by the source value.
     *
     * @default undefined
     */
    fields?: MergeFields<T>;
}

/**
 * Options accepted by `VSRepository.merge()`: everything in `MethodOptions` plus `mergeConfig`.
 *
 * @template T Entity type managed by the repository.
 * @template K ORM client/transaction types, used to type `db`.
 *
 * @publicApi
 */
export interface MergeOptions<T, K extends VSRepoOrmTypes = VSRepoOrmTypes> extends MethodOptions<T, K> {
    /**
     * Merge configuration for this call. It **replaces** the `mergeConfig` given in the
     * repository's constructor options.
     *
     * default: The repository's `mergeConfig`, or no configuration if it doesn't have one
     */
    mergeConfig?: MergeConfig<T>;
}

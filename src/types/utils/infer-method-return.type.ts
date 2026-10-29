import { RelationKeys } from "../vsrepo/vsrepo-relations.type.js";
import { SeeMode } from "./see-mode.type.js";

/**
 * Loose constraint for the `Options` accepted by `InferMethodReturn`: the keys of `MethodOptions`
 * without depending on the entity type.
 */
type InferMethodReturnOptions = {
    select?: object | undefined;
    relations?: object | undefined;
    see?: SeeMode | undefined;
    db?: unknown;
};

/** Flattens an intersection into a single object type (keeps modifiers). */
type Simplify<X> = { [K in keyof X]: X[K] } & {};

/** Safe `O[K]`: `undefined` when `K` is not a key of `O`. */
type Get<O, K extends string> = K extends keyof O ? O[K] : undefined;

/**
 * How a given option (`select`/`relations`) was typed:
 * - `"absent"`  — not provided (or explicitly `undefined`);
 * - `"unknown"` — declared but not narrowed (optional/wide, e.g. a variable annotated as
 *                 plain `MethodOptions<T>`), so its contents can't be known at compile time;
 * - `"known"`   — a narrowed object type (e.g. `{ id: true }` obtained via `satisfies`).
 */
type OptionState<O, K extends string> = [Get<O, K>] extends [undefined]
    ? "absent"
    : undefined extends Get<O, K>
      ? "unknown"
      : "known";

/** Keys present in a `select`/`relations` spec (`undefined` spec has none). */
type SpecKeys<S> = S extends object ? keyof S : never;

/**
 * Nested spec of key `K` inside `S`: the object itself when it's a nested
 * `select`/`relations`, or `undefined` when the value is just `true`.
 */
type SubSpec<S, K> = S extends object
    ? K extends keyof S
        ? NonNullable<S[K]> extends object
            ? NonNullable<S[K]>
            : undefined
        : undefined
    : undefined;

/** Keys of `T` that are scalar fields (i.e. not relations). */
type ScalarKeys<T> = Exclude<keyof T, RelationKeys<T>>;

/** Which option is currently driving the shape. */
type SpecMode = "select" | "relations";

/** Scalar keys kept in the result: only the ones in a `select` spec, all of them otherwise. */
type ResultScalarKeys<T, Spec, Mode extends SpecMode> = Mode extends "select"
    ? Spec extends object
        ? Extract<SpecKeys<Spec>, ScalarKeys<T>>
        : ScalarKeys<T>
    : ScalarKeys<T>;

/** Relation keys kept in the result: the relation keys present in the spec. */
type ResultRelationKeys<T, Spec> = Extract<SpecKeys<Spec>, RelationKeys<T>>;

/** Applies the shape to a relation field, preserving its array-ness and nullability. */
type MapRelation<F, Spec, Mode extends SpecMode> = F extends readonly (infer U)[]
    ? Shape<U, Spec, Mode>[]
    : F extends null | undefined
      ? F
      : Shape<F, Spec, Mode>;

/**
 * Shape of a single entity `T` given a `select` spec (`Mode = "select"`) or
 * a `relations` spec (`Mode = "relations"`).
 *
 * - `select` mode: only the fields present in the spec; a relation set to `true` brings all of
 *   its scalar fields (no nested relations), a nested object restricts it further.
 * - `relations` mode: every scalar field plus the relations present in the spec (recursively).
 * - No spec (`undefined`): every scalar field, no relations.
 */
type Shape<T, Spec, Mode extends SpecMode> = Simplify<
    {
        [K in keyof T as K extends ResultScalarKeys<T, Spec, Mode> ? K : never]: T[K];
    } & {
        [K in keyof T as K extends ResultRelationKeys<T, Spec> ? K : never]: MapRelation<T[K], SubSpec<Spec, K>, Mode>;
    }
>;

/**
 * Resolves the shape of a single entity `T` (not an array, not nullable) from the method options.
 * `select` takes precedence: when present, `relations` is ignored. If the option that drives
 * the shape is not narrowed, its contents are unknown and `T` is returned unchanged.
 */
type InferEntity<T, O> =
    OptionState<O, "select"> extends "known"
        ? Shape<T, NonNullable<Get<O, "select">>, "select">
        : OptionState<O, "select"> extends "unknown"
          ? T
          : OptionState<O, "relations"> extends "known"
            ? Shape<T, NonNullable<Get<O, "relations">>, "relations">
            : OptionState<O, "relations"> extends "unknown"
              ? T
              : Shape<T, undefined, "relations">;

/**
 * Opt-in strict return type: narrows what a repository method returns according to the `select` /
 * `relations` actually passed to it. By default, methods return the whole entity.
 *
 * - no `select`/`relations`: only the scalar fields;
 * - `relations`: scalar fields plus the requested relations (nested included);
 * - `select`: only the selected fields. It takes precedence over `relations`.
 *
 * `null` and array-ness of `T` are preserved. The options must keep their literal type (declare
 * them with `satisfies MethodOptions<T>`); if typed as plain `MethodOptions<T>`, `T` is returned unchanged.
 *
 * @template T What the method returns: `Entity`, `Entity | null` or `Entity[]`.
 * @template Options The options object passed to the method (`typeof options`).
 *
 * @example
 * ```typescript
 * const options = { select: { id: true, name: true } } satisfies MethodOptions<User>;
 *
 * const users: InferMethodReturn<User[], typeof options> = await userRepository.find({}, options);
 * // { id: string; name: string }[]
 * ```
 *
 * @publicApi
 */
export type InferMethodReturn<T, Options extends InferMethodReturnOptions = {}> = T extends readonly (infer U)[]
    ? InferEntity<U, Options>[]
    : T extends null | undefined
      ? T
      : InferEntity<T, Options>;

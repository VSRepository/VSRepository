import { RelationKeys } from "../vsrepo/vsrepo-relations.type.js";
import { SeeMode } from "./see-mode.type.js";

/**
 * Loose structural constraint for the `Options` accepted by {@link InferMethodReturn}.
 * Mirrors the four keys of `MethodOptions` without depending on the entity type.
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
 * Opt-in **strict** return typing: narrows the type returned by a repository method
 * according to the `select` / `relations` that were actually passed to it.
 *
 * By default, `VSRepository` methods type their return as the whole entity, ignoring
 * `select` and `relations` (the same approach TypeORM takes). Use this utility when you
 * prefer a tighter type:
 *
 * - **no `select`/`relations`** — only the scalar fields of the entity (no relations);
 * - **`relations`** — the scalar fields plus the requested relations (nested ones included);
 * - **`select`** — only the selected fields. A relation selected with `true` brings all of its
 *   scalar fields; a nested `select` restricts it further. Relations selected this way are
 *   loaded even without `relations`.
 *
 * `select` takes precedence over `relations`: when `select` is present, `relations` is
 * ignored by the type. This mirrors the Prisma 7 adapter and never promises fields an
 * adapter might not return.
 *
 * `see` and `db` don't affect the result type.
 *
 * The first type argument is what the method returns: `Entity`, `Entity | null` or
 * `Entity[]` — `null`/array-ness are preserved (also on relation fields, e.g.
 * `address: Address | null`).
 *
 * The options must keep their literal type, so declare them with `satisfies MethodOptions<T>`
 * (or inline). If the options are typed as plain `MethodOptions<T>`, nothing is known
 * at compile time and the whole entity `T` is returned unchanged (the default typing).
 *
 * @template T What the method returns: `Entity`, `Entity | null` or `Entity[]`.
 * @template Options The options object passed to the method (`typeof options`).
 *
 * @example
 * ```ts
 * const options = {
 *     select: { id: true, name: true, products: { id: true } },
 * } satisfies MethodOptions<User>;
 *
 * const users: InferMethodReturn<User[], typeof options> = await userRepository.getAll(options);
 * // { id: string; name: string; products: { id: string }[] }[]
 * ```
 *
 * @publicApi
 */
export type InferMethodReturn<T, Options extends InferMethodReturnOptions = {}> = T extends readonly (infer U)[]
    ? InferEntity<U, Options>[]
    : T extends null | undefined
      ? T
      : InferEntity<T, Options>;

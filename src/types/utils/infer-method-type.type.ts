import { VSRepoOrmTypes } from "../vsrepo/vsrepo-orm-types.type.js";
import { RelationKeys, VSRepoRelations } from "../vsrepo/vsrepo-relations.type.js";
import { VSRepoSelect } from "../vsrepo/vsrepo-select.type.js";
import { InferMethodReturn } from "./infer-method-return.type.js";
import { MethodOptions } from "./methods-options.type.js";

/** Entity type behind a method's return: `E`, `E | null`, `E[]` or `E[] | null` all give `E`. */
type EntityOf<R> = NonNullable<R> extends readonly (infer U)[] ? U : NonNullable<R>;

/**
 * Deeply checks that a `select`/`relations` object only has keys that exist in the reference
 * spec (`VSRepoSelect<E>`/`VSRepoRelations<E>`), turning unknown keys into `never`.
 *
 * Needed because a generic parameter (`Options` in `InferMethodType`) loses TypeScript's
 * excess property check, so a typo like `select: { id: true, idd: true }` would otherwise be
 * silently accepted.
 *
 * Non-object values (e.g. `true`) resolve to `unknown` (the identity of `&`): they are already
 * validated by the `Options` constraint, and contributing nothing here keeps stray members of
 * `boolean` (like `valueOf`) out of the editor's suggestions.
 */
type ExactSpec<S, Ref> = S extends object
    ? [Extract<Ref, object>] extends [never]
        ? never
        : {
              [K in keyof S]: K extends keyof Extract<Ref, object>
                  ? ExactSpec<S[K], NonNullable<Extract<Ref, object>[K]>>
                  : never;
          }
    : unknown;

/** Entity type behind a relation field: `U` for `U[]`, `U | null` and `U`. */
type RelatedOf<F> = NonNullable<F> extends readonly (infer U)[] ? NonNullable<U> : NonNullable<F>;

/**
 * Checks that a `relationsOptions` object only names relation fields of `E`, and that each one only
 * has the keys its kind allows (`order`/`pagination` are exclusive to to-many relations and `where`
 * to to-many and optional to-one relations), recursing into the nested `relationsOptions`. The
 * values of `where`, `order` and `pagination` are validated by the `Options` constraint, so they
 * pass through.
 */
type ExactRelationsOptions<S, E> = S extends object
    ? {
          [P in keyof S]: P extends RelationKeys<E> ? ExactRelationOptions<S[P], E[P & keyof E]> : never;
      }
    : unknown;

/** `F` is the type of the relation field, which tells to-many from to-one and optional from required. */
type ExactRelationOptions<S, F> = S extends object
    ? {
          [K in keyof S]: K extends "where"
              ? NonNullable<F> extends readonly unknown[]
                  ? S[K]
                  : null extends F
                    ? S[K]
                    : undefined extends F
                      ? S[K]
                      : never
              : K extends "order" | "pagination"
                ? NonNullable<F> extends readonly unknown[]
                    ? S[K]
                    : never
                : K extends "relationsOptions"
                  ? ExactRelationsOptions<S[K], RelatedOf<F>>
                  : never;
      }
    : unknown;

/**
 * Applies `ExactSpec` to `select` and `relations` and `ExactRelationsOptions` to `relationsOptions`;
 * `see`/`db` pass through, unknown keys become `never`.
 */
type ExactOptions<O, E> = {
    [K in keyof O]: K extends "select"
        ? ExactSpec<O[K], VSRepoSelect<E>>
        : K extends "relations"
          ? ExactSpec<O[K], VSRepoRelations<E>>
          : K extends "relationsOptions"
            ? ExactRelationsOptions<O[K], E>
            : K extends "see" | "db"
              ? O[K]
              : never;
};

/**
 * Declares a dynamic method whose return type is strictly inferred from the `select` / `relations`
 * passed on each call (same rules as `InferMethodReturn`). Unknown keys in `select`/`relations`/`relationsOptions` are rejected.
 * `options` is always the last parameter.
 *
 * @template Args Positional arguments of the method, without `options` (e.g. `[name: string]`).
 * @template R What the method resolves to: `Entity`, `Entity | null` or `Entity[]`.
 * @template K ORM types, used to type the `db` option.
 *
 * @example
 * ```typescript
 * class UserRepository extends VSRepository<User, string, MyOrmTypes> {
 *     *@DynamicMethod()
 *     declare findByName: InferMethodType<[name: string], User[], MyOrmTypes>;
 * }
 *
 * const users = await userRepository.findByName("John", { select: { id: true, name: true } });
 * // { id: string; name: string }[]
 * ```
 *
 * @publicApi
 */
export type InferMethodType<Args extends unknown[], R, K extends VSRepoOrmTypes = VSRepoOrmTypes> = {
    (...args: Args): Promise<InferMethodReturn<R, {}>>;

    // IMPORTANT: `Options` must NOT have a default (e.g. `= {}`) to cover the "no options" case.
    // While the user is typing the options object there is nothing to infer `Options` from yet, and
    // TypeScript then uses its default as the contextual type: with `= {}` the editor stops
    // suggesting `select`/`relations`/`see`/`db` and the entity fields. The "no options" case is
    // handled by the overload above instead.
    <Options extends MethodOptions<EntityOf<R>, K>>(
        ...args: [...Args, options?: Options & ExactOptions<Options, EntityOf<R>>]
    ): Promise<InferMethodReturn<R, Options>>;
};

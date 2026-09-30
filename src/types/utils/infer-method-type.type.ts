import { VSRepoOrmTypes } from "../vsrepo/vsrepo-orm-types.type.js";
import { VSRepoRelations } from "../vsrepo/vsrepo-relations.type.js";
import { VSRepoSelect } from "../vsrepo/vsrepo-select.type.js";
import { InferMethodReturn } from "./infer-method-return.type.js";
import { MethodOptions } from "./methods-options.type.js";

/** Entity type behind a method's return: `E`, `E | null`, `E[]` or `E[] | null` all give `E`. */
type EntityOf<R> = NonNullable<R> extends readonly (infer U)[] ? U : NonNullable<R>;

/**
 * Deeply checks that a `select`/`relations` object only has keys that exist in the reference
 * spec (`VSRepoSelect<E>`/`VSRepoRelations<E>`), turning unknown keys into `never`.
 *
 * Needed because a generic parameter (`Options` in {@link InferMethodType}) loses TypeScript's
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

/** Applies {@link ExactSpec} to `select` and `relations`; `see`/`db` pass through, unknown keys become `never`. */
type ExactOptions<O, E> = {
    [K in keyof O]: K extends "select"
        ? ExactSpec<O[K], VSRepoSelect<E>>
        : K extends "relations"
          ? ExactSpec<O[K], VSRepoRelations<E>>
          : K extends "see" | "db"
            ? O[K]
            : never;
};

/**
 * Type for declaring a dynamic method whose return type is **strictly inferred** from the
 * `select` / `relations` passed on each call (see {@link InferMethodReturn} for the exact rules).
 *
 * It has two call signatures:
 * - `(...args) => Promise<...>` — no `options`: only the scalar fields of the entity;
 * - `(...args, options?: MethodOptions<Entity, OrmTypes>) => Promise<...>` — the return is
 *   inferred from the `options` passed.
 *
 * `Entity` is taken from the return type (`Entity`, `Entity | null`, `Entity[]`, ...).
 *
 * The `options` parameter is always the last one, after every argument in `Args` (as in a
 * regular dynamic method signature). Unknown keys in `select`/`relations` are rejected, just like
 * with a plain `MethodOptions<Entity>` parameter, and the editor autocompletes them.
 *
 * Meant for dynamic methods that return entities. Methods that don't (`existsBy...`,
 * `countBy...`, etc.) can keep their regular signature.
 *
 * @template Args Positional arguments of the method, without `options` (e.g. `[name: string]`).
 * @template R What the method resolves to: `Entity`, `Entity | null` or `Entity[]`.
 * @template K ORM type map (`dbClient`/`dbTransaction`) used to type the `db` option. Optional.
 *
 * @example
 * ```ts
 * class UserRepository extends VSRepository<User, string, MyOrmTypes> {
 *     @DynamicMethod()
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

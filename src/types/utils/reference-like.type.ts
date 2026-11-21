/**
 * Structural shape of an ORM reference wrapper (e.g. MikroORM's `Reference<T>` and `ScalarReference<V>`).
 * Any object with `load()` and `unwrap()` matches.
 *
 * What the field is depends on `T`:
 *
 * - `T` is a `Primitive`: the field is a scalar (a lazy column, for example), as if it were typed as `T`.
 * - otherwise: the field is a to-one relation of `T`, as if it were typed as `T`.
 *
 * @template T Type of the wrapped value (a scalar or an entity).
 *
 * @publicApi
 */
export interface ReferenceLike<T = any> {
    load(): Promise<T | null | undefined>;
    unwrap(): T | undefined;
}

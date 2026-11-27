/**
 * Structural shape of an ORM collection wrapper (e.g. MikroORM's `Collection<T>`).
 *
 * A field typed as a `CollectionLike<T>` is treated as a to-many relation of `T`, the same way an array
 * of entities is: it takes part in `relations`, `select`, `where` (`_some`/`_every`/`_none`) and
 * `relationsOptions`. Any object with these four methods matches.
 *
 * @template T Type of the items held by the collection.
 *
 * @publicApi
 */
export interface CollectionLike<T = any> {
    getItems(): T[];
    add(...items: T[]): void;
    remove(...items: T[]): void;
    count(): number;
}

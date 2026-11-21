import { FieldKind, FieldType, UnwrapReference } from "../utils/field-kind.type.js";
import { Ordering } from "../utils/ordering.type.js";
import { Pagination } from "../utils/pagination.type.js";
import { RelationKeys } from "./vsrepo-relations.type.js";
import { VSRepoWhere } from "./vsrepo-where.type.js";

/**
 * Options applied to a relation when it is loaded, through `select` or `relations`, that can only
 * configure its own relations: the base of every kind of relation options.
 *
 * @template U Entity type of the related record(s).
 *
 * @publicApi
 */
export type VSRepoRelationOptions<U> = {
    /** Options for the relations of this relation. */
    relationsOptions?: VSRepoRelationsOptions<U>;
};

/**
 * Options applied to a to-one relation that can be `null`/`undefined` (for example,
 * `profile: Profile | null`), which can also be filtered with `where`.
 *
 * @template U Entity type of the related record.
 *
 * @publicApi
 */
export type VSRepoOptionalRelationOptions<U> = VSRepoRelationOptions<U> & {
    /**
     * Filters the related record that gets loaded. Unlike the `_some`/`_every`/`_none`/`_with`/`_without`
     * operators of the top-level `where` (which filter the **parent** records), this one only affects
     * what is loaded into the relation: records that don't match are left out (to-many) or the
     * relation becomes `null` (to-one).
     */
    where?: VSRepoWhere<U>;
};

/**
 * Options applied to a to-many relation (`otm`/`mtm`) when it is loaded, through
 * `select` or `relations`. Same as `VSRepoOptionalRelationOptions`, plus `order` and `pagination`.
 *
 * @template U Entity type of the related records.
 *
 * @publicApi
 */
export type VSRepoToManyRelationOptions<U> = VSRepoOptionalRelationOptions<U> & {
    /** Ordering of the related records. */
    order?: Ordering<U>;
    /** Limit and offset of the related records, applied **per parent record**.. */
    pagination?: Pagination;
};

/**
 * Shape accepted by the `relationsOptions` option of repository/adapter methods, used to filter,
 * order and paginate the related records loaded by `select` or `relations`.
 *
 * It only configures how a relation is loaded: it does not load it by itself, so the relation still
 * has to be present in `select` or `relations`.
 *
 * @example
 * ```typescript
 * const options = {
 *     relations: { posts: { comments: true } },
 *     relationsOptions: {
 *         posts: {
 *             where: { published: true },
 *             order: { createdAt: "desc" },
 *             pagination: { limit: 10 },
 *             relationsOptions: { comments: { pagination: { limit: 5 } } },
 *         },
 *     },
 * } satisfies MethodOptions<User>;
 * ```
 *
 * @publicApi
 */
export type VSRepoRelationsOptions<T> = {
    [P in RelationKeys<T>]?: FieldKind<T[P]> extends "to-many"
        ? VSRepoToManyRelationOptions<FieldType<T[P]>>
        : null extends UnwrapReference<T[P]>
          ? VSRepoOptionalRelationOptions<FieldType<T[P]>>
          : undefined extends UnwrapReference<T[P]>
            ? VSRepoOptionalRelationOptions<FieldType<T[P]>>
            : VSRepoRelationOptions<FieldType<T[P]>>;
};

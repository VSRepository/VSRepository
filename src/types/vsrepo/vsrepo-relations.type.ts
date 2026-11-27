import { FieldKind, FieldType } from "../utils/field-kind.type.js";

/**
 * Extracts the keys of `T` that represent relation fields.
 *
 * @publicApi
 */
export type RelationKeys<T> = {
    [P in keyof T]: FieldKind<T[P]> extends "scalar" ? never : P;
}[keyof T];

/**
 * Shape accepted by the `relations` option of repository/adapter methods,
 * used to eagerly load related records alongside the main result.
 *
 * @publicApi
 */
export type VSRepoRelations<T> = {
    [P in RelationKeys<T>]?: boolean | VSRepoRelations<FieldType<T[P]>>;
};

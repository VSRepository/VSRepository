import { FieldKind, FieldType } from "../utils/field-kind.type.js";

/**
 * Selection shape accepted by the `select` option of repository/adapter methods.
 *
 * @publicApi
 */
export type VSRepoSelect<T> = {
    [P in keyof T]?: FieldKind<T[P]> extends "scalar" ? boolean : VSRepoSelect<FieldType<T[P]>> | boolean;
};

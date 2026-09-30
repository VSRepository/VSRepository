import { QueryMethodOptions } from "../decorators/query-method-options.type.js";

export type VSRepoQuery = QueryMethodOptions & {
    propertyKey: string | symbol;
    value: string;
};

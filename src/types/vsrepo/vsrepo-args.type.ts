import { AdapterMethodOptions } from "../adapter/adapter-method-options.type.js";
import { VSRepoWhere } from "./vsrepo-where.type.js";

export type VSRepoArgs<T> = {
    where?: VSRepoWhere<T>;
    obj?: object;
    create?: object;
    update?: object;
    options?: AdapterMethodOptions<T>;
};

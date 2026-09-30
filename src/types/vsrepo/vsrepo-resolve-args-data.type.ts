import { VSRepository } from "../../VSRepository.js";
import { Pagination } from "../utils/pagination.type.js";
import { MethodOptions } from "../utils/methods-options.type.js";

export interface VSRepoResolveArgsData<T, K> {
    instance: VSRepository<T, K>;
    options: MethodOptions<T>;
    withoutWhere?: boolean;
    withoutSelect?: boolean;
    specificSelect?: object;
    specificWhere?: object;
    dataPayload?: object;
    createPayload?: object;
    updatePayload?: object;
    pagination?: Pagination;
    ordering?: object | object[];
    ignoreConflicts?: boolean;
    withOrderingAndPagination?: boolean;
    distinctKeys?: string[];
}

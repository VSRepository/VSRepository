import { VSRepoPrettyWhere } from "../vsrepo/vsrepo-pretty-where.type.js";
import { VSRepoUglyWhere } from "../vsrepo/vsrepo-ugly-where.type.js";

export interface DynamicMethodWhereOps {
    uglyWheres: VSRepoUglyWhere[];
    prettyWheres: VSRepoPrettyWhere[];
}

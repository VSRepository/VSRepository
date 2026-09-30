import * as v from "valibot";
import { VSRepoRelations } from "../../../types/vsrepo/vsrepo-relations.type.js";

const relationsSchema: v.GenericSchema<VSRepoRelations<Record<string, unknown>>> = v.lazy(() =>
    v.record(v.string(), v.optional(v.union([v.boolean(), relationsSchema]))),
);

export default relationsSchema;

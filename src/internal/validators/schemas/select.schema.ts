import * as v from "valibot";
import { VSRepoSelect } from "../../../types/vsrepo/vsrepo-select.type.js";

const selectSchema: v.GenericSchema<VSRepoSelect<Record<string, unknown>>> = v.lazy(() =>
    v.record(v.string(), v.optional(v.union([v.boolean(), selectSchema]))),
);

export default selectSchema;

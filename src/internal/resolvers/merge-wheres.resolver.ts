import merge from "deepmerge";
import { SeeMode } from "../../types/utils/see-mode.type.js";
import { VSRepoWhere } from "../../types/vsrepo/vsrepo-where.type.js";

export class MergeWheresResolver<T> {
    constructor(private readonly softDeleteField?: string) {}

    resolve(see: SeeMode = "active", provided?: VSRepoWhere<T>): VSRepoWhere<T> {
        const objectsToMerge: VSRepoWhere<T>[] = [];

        if (provided) objectsToMerge.push(provided);
        if (this.softDeleteField && see !== "all") {
            objectsToMerge.push({
                [this.softDeleteField]: see === "active" ? null : { not: null },
            } as VSRepoWhere<T>);
        }

        const whereResolved = merge.all(objectsToMerge);

        return whereResolved;
    }
}

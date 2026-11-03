import { ENABLE_SOFT_DELETE_KEY } from "../internal/constants/enable-soft-delete-key.constant.js";
import { SoftDeleteMetadata } from "../types/decorators/soft-delete-metadata.type.js";
import { KeysOfType } from "../types/utils/keys-of-type.type.js";
import { Primitive } from "../types/utils/primitive.type.js";
import { VSRepository } from "../VSRepository.js";

/**
 * Enables soft delete on a `VSRepository` subclass: reads only see non-deleted records (see the `see`
 * option) and `softDelete`/`restore` (and their variants) become available.
 *
 * @param field Nullable date field that marks a record as deleted. Defaults to the `softDeleteField`
 * of `VSRepository.setGlobalConfig()`.
 *
 * @example
 * ```typescript
 * *@EnableSoftDelete("deletedAt")
 * class UserRepository extends VSRepository<User, string> {}
 * ```
 *
 * @publicApi
 */
export function EnableSoftDelete<Entity>(
    field?: (KeysOfType<Entity, Primitive> & string) | (string & {}),
): (target: typeof VSRepository<Entity, any>) => void {
    return target => {
        Reflect.defineMetadata(ENABLE_SOFT_DELETE_KEY, { field, active: true } satisfies SoftDeleteMetadata, target);
    };
}

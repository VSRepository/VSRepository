import { ENABLE_SOFT_DELETE_KEY } from "../internal/constants/enable-soft-delete-key.constant.js";
import { SoftDeleteMetadata } from "../types/decorators/soft-delete-metadata.type.js";

/**
 * @publicApi
 */
export function EnableSoftDelete(field?: string): ClassDecorator {
    return (target: Function): void => {
        Reflect.defineMetadata(ENABLE_SOFT_DELETE_KEY, { field, active: true } satisfies SoftDeleteMetadata, target);
    };
}

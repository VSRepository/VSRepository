import { DYNAMIC_METHODS_KEY } from "../internal/constants/dynamic-methods-key.constant.js";
import { getOwnMetadataList } from "../internal/utils/get-own-metadata-list.util.js";
import { DecoratorsValidator } from "../internal/validators/decorators.validator.js";
import { DynamicMethodOptions } from "../types/decorators/dynamic-method-options.type.js";
import { VSRepoMethod } from "../types/vsrepo/vsrepo-method.type.js";

/**
 * Property decorator used to declare a dynamic method on a `VSRepository` subclass.
 *
 * Applied to a `declare` class field whose name follows one of the supported
 * dynamic-method patterns (e.g. `findOneByEmail`, `findByStatusPaginated`,
 * `upsertById`), the method's behavior is inferred from the field name at
 * construction time, optionally adjusted via `options`.
 *
 * @template T Entity type the decorated method operates on.
 *
 * @example
 * ```typescript
 * class UserRepository extends VSRepository<User, string> {
 *     *@DynamicMethod()
 *     declare findByEmail: (email: string) => Promise<User[]>;
 * }
 * ```
 *
 * @publicApi
 */
export function DynamicMethod<T = any>(options?: DynamicMethodOptions<T>): PropertyDecorator {
    const validatedOptions = DecoratorsValidator.validateDynamicMethodOptions<T>(options);

    return (target: object, propertyKey: string | symbol) => {
        const methods = getOwnMetadataList<VSRepoMethod>(DYNAMIC_METHODS_KEY, target);

        methods.push({ ...validatedOptions, propertyKey });

        Reflect.defineMetadata(DYNAMIC_METHODS_KEY, methods, target);
    };
}

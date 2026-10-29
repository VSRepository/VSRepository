import { DYNAMIC_METHODS_KEY } from "../internal/constants/dynamic-methods-key.constant.js";
import { DynamicMethodOptions } from "../types/decorators/dynamic-method-options.type.js";

/**
 * Declares a dynamic method on a `VSRepository` subclass. Applied to a `declare` field, its behavior
 * is inferred from the field name (e.g. `findOneByEmail`, `findByStatusPaginated`, `upsertById`)
 * when the repository is created.
 *
 * @param options Use `proxyTo` for names that don't follow the convention and `injectOrdering` for a fixed ordering.
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
    return (target: object, propertyKey: string | symbol) => {
        const methodsMap: Map<string | symbol, DynamicMethodOptions> =
            Reflect.getOwnMetadata(DYNAMIC_METHODS_KEY, target) ??
            new Map(Reflect.getMetadata(DYNAMIC_METHODS_KEY, target) ?? []);

        methodsMap.set(propertyKey, options ?? {});

        Reflect.defineMetadata(DYNAMIC_METHODS_KEY, methodsMap, target);
    };
}

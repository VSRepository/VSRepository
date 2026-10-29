import { QUERY_METHODS_KEY } from "../internal/constants/query-methods-key.constant.js";
import type { QueryMethodOptions } from "../types/decorators/query-method-options.type.js";
import { VSRepoQuery } from "../types/vsrepo/vsrepo-query.type.js";

/**
 * Declares a raw SQL method on a `VSRepository` subclass. Applied to a `declare` field, it runs `value`
 * through the adapter, binding the call's arguments to the placeholders (`?1`, `?2`, ..., unless
 * `vsPlaceholders` is `false`). Pass `withDb(tx)` as the last argument to run the call in a transaction.
 *
 * @param value SQL statement. Use placeholders for values; never interpolate them into the string.
 * @param options Set `modifying: true` for `INSERT`/`UPDATE`/`DELETE` and `singleResult` to get the first row.
 *
 * @example
 * ```typescript
 * class UserRepository extends VSRepository<User, string> {
 *     *@QueryMethod('SELECT * FROM "user" WHERE email = ?1')
 *     declare findByEmail: (email: string, db?: DbArg) => Promise<User[]>;
 *
 *     *@QueryMethod('UPDATE "user" SET active = true WHERE id = ?1', { modifying: true })
 *     declare activateUser: (id: string, db?: DbArg) => Promise<number>;
 * }
 * ```
 *
 * @publicApi
 */
export function QueryMethod(value: string, options?: QueryMethodOptions): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const methodsMap: Map<string | symbol, VSRepoQuery> =
            Reflect.getOwnMetadata(QUERY_METHODS_KEY, target) ??
            new Map(Reflect.getMetadata(QUERY_METHODS_KEY, target) ?? []);

        methodsMap.set(propertyKey, { ...options, value });

        Reflect.defineMetadata(QUERY_METHODS_KEY, methodsMap, target);
    };
}

import { DbArg } from "../../internal/utils/db-arg.util.js";
import { VSRepoOrmTypes } from "../vsrepo/vsrepo-orm-types.type.js";

/**
 * Types the parameter list of a `@QueryMethod` declared with
 * `{ spreadArgs: true }`: the SQL placeholder values (`T`), in order,
 * followed by an optional trailing {@link DbArg} — built via {@link withDb} —
 * to run the query against a specific client or transaction instead of the
 * repository's default one.
 *
 * @example
 * ```typescript
 * class UserRepository extends VSRepository<User, string> {
 *     @QueryMethod('SELECT * FROM "user" WHERE email = $1 AND "userType" = $2', {
 *         spreadArgs: true,
 *     })
 *     declare findByEmailAndType: (
 *         ...args: QueryArgs<[email: string, userType: string]>
 *     ) => Promise<User[]>;
 * }
 *
 * await userRepository.findByEmailAndType("joao@email.com", "admin");
 * await userRepository.findByEmailAndType("joao@email.com", "admin", withDb(tx));
 * ```
 *
 * @publicApi
 */
export type QueryArgs<T extends Array<any> = [], O extends VSRepoOrmTypes = VSRepoOrmTypes> = [...T, db?: DbArg<O>];

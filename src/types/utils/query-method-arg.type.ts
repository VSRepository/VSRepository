import { VSRepoOrmTypes } from "../vsrepo/vsrepo-orm-types.type.js";

/**
 * Single argument accepted by a method declared with `@QueryMethod`.
 *
 * `args` are injected positionally into the raw SQL statement's placeholders,
 * allowing safe parameter injection instead of string-concatenating values
 * directly into the query.
 *
 * The placeholder syntax depends on the database/driver behind your adapter.
 *
 * @template T Tuple type of the positional SQL parameters, e.g. `[email: string]`.
 *
 * @example
 * ```typescript
 * class UserRepository extends VSRepository<User, string> {
 *     @QueryMethod('SELECT * FROM "user" WHERE email = $1')
 *     declare findByEmailRaw: (arg: QueryMethodArg<[email: string]>) => Promise<User[]>;
 * }
 *
 * await userRepository.findByEmailRaw({ args: ["joao@email.com"] });
 * ```
 *
 * @publicApi
 */
export type QueryMethodArg<T extends Array<any> = [], O extends VSRepoOrmTypes = VSRepoOrmTypes> = {
    /** Positional parameters injected into the SQL placeholders — the placeholder syntax depends on the database/driver behind your adapter. */
    args?: T;
    /** Database client or transaction to run this query in, instead of the repository's default client. */
    db?: O["dbClient"] | O["dbTransaction"];
};

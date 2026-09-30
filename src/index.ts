import "reflect-metadata";

// Public classes / constructors
export { VSRepository } from "./VSRepository.js";
export { VSRepoAdapter } from "./VSRepoAdapter.js";
export { VSRepoError } from "./errors/VSRepoError.js";
export { VSRepoAdapterError } from "./errors/VSRepoAdapterError.js";
export { DbArg } from "./internal/utils/db-arg.util.js";
export { VSQueryBuilder } from "./internal/utils/vs-query-builder.util.js";
export { VSRawQueryBuilder } from "./internal/utils/vs-raw-query-builder.util.js";
export { VSSql } from "./internal/utils/vs-sql.util.js";

// Decorators
export { DynamicMethod } from "./decorators/dynamic-method.decorator.js";
export { QueryMethod } from "./decorators/query-method.decorator.js";

// Public enums
export { VSRepoErrorType } from "./internal/enums/vsrepo-error-type.enum.js";
export { VSLogLevel } from "./internal/enums/vs-log-level.enum.js";
export { TransactionIsolationLevel } from "./internal/enums/transaction-isolation-level.enum.js";
export { AdapterErrorCode } from "./internal/enums/adapter-error-code.enum.js";

// Public functions
export { withDb } from "./internal/utils/with-db.util.js";

// Public types
export type { VSRepoOptions } from "./types/vsrepo/vsrepo-options.type.js";
export type { VSRepoOrmTypes } from "./types/vsrepo/vsrepo-orm-types.type.js";
export type { VSRepoArgs } from "./types/vsrepo/vsrepo-args.type.js";
export type { VSRepoMethod } from "./types/vsrepo/vsrepo-method.type.js";
export type {
    VSRepoWhere,
    VSRepoWherePlain,
    VSRepoFieldWhere,
    VSRepoFieldOperators,
} from "./types/vsrepo/vsrepo-where.type.js";
export type { VSRepoRelations, RelationKeys } from "./types/vsrepo/vsrepo-relations.type.js";
export type { VSRepoSelect } from "./types/vsrepo/vsrepo-select.type.js";
export type { VSRepoTransactionOptions } from "./types/vsrepo/vsrepo-transaction-options.type.js";
export type { AdapterMethodOptions } from "./types/adapter/adapter-method-options.type.js";
export type { AdapterQueryOptions } from "./types/adapter/adapter-query-options.type.js";
export type { DynamicMethodOptions } from "./types/decorators/dynamic-method-options.type.js";
export type { QueryMethodOptions } from "./types/decorators/query-method-options.type.js";
export type { QueryMethodArg } from "./types/utils/query-method-arg.type.js";
export type { CountResult } from "./types/utils/count-result.type.js";
export type { DeepPartial } from "./types/utils/deep-partial.type.js";
export type { KeysOfType } from "./types/utils/keys-of-type.type.js";
export type { MethodOptions } from "./types/utils/methods-options.type.js";
export type { InferMethodReturn } from "./types/utils/infer-method-return.type.js";
export type { InferMethodType } from "./types/utils/infer-method-type.type.js";
export type { Ordering, OrderByField, SortDirection } from "./types/utils/ordering.type.js";
export type { Pagination } from "./types/utils/pagination.type.js";
export type { Primitive } from "./types/utils/primitive.type.js";
export type { SeeMode } from "./types/utils/see-mode.type.js";
export type { VSRepoQueryOptions } from "./types/vsrepo/vsrepo-query-options.type.js";
export type { DecimalLike } from "./types/utils/decimal-like.type.js";
export type { NumericKeys } from "./types/utils/numeric-keys.type.js";
export type { NumericLike } from "./types/utils/numeric-like.type.js";
export type { RestrictMethodOptions } from "./types/utils/restrict-method-options.type.js";
export type { QueryArgs } from "./types/utils/query-args.type.js";
export type { VSRawQueryBuilderTarget } from "./types/vsrepo/vs-raw-query-builder-target.type.js";
export type { VSRawQueryBuilderCteQuery } from "./types/vsrepo/vs-raw-query-builder-cte-query.type.js";

// Internal features
export { VSLogger } from "./internal/utils/vs-logger.util.js";

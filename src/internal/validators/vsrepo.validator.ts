import * as v from "valibot";
import { VSRepoOptions } from "../../types/vsrepo/vsrepo-options.type.js";
import { VSLogLevel } from "../enums/vs-log-level.enum.js";
import { VSRepoError } from "../../errors/VSRepoError.js";
import orderingSchema from "./schemas/ordering.schema.js";
import { MethodOptions } from "../../types/utils/methods-options.type.js";
import { QueryMethodArg } from "../../types/utils/query-method-arg.type.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
import { VSRepoTransactionOptions } from "../../types/vsrepo/vsrepo-transaction-options.type.js";
import { TransactionIsolationLevel } from "../enums/transaction-isolation-level.enum.js";
import { VSRepoOrmTypes } from "../../types/vsrepo/vsrepo-orm-types.type.js";
import { Pagination } from "../../types/utils/pagination.type.js";
import { Ordering } from "../../types/utils/ordering.type.js";
import { VSLogger } from "../utils/vs-logger.util.js";
import paginationSchema from "./schemas/pagination.schema.js";
import whereSchema from "./schemas/where.schema.js";
import { VSRepoWhere } from "../../types/vsrepo/vsrepo-where.type.js";
import { VSRepoQueryOptions } from "../../types/vsrepo/vsrepo-query-options.type.js";
import { NumericLike } from "../../types/utils/numeric-like.type.js";
import { RestrictMethodOptions } from "../../types/utils/restrict-method-options.type.js";
import selectSchema from "./schemas/select.schema.js";
import relationsSchema from "./schemas/relations.schema.js";

export class VSRepoValidator<T, K, O extends VSRepoOrmTypes = VSRepoOrmTypes> {
    // * Setado depois pelo VSRepository, pois no momento em que validateConstructorOptions
    // * roda (validação das próprias options do construtor, incluindo o logLevel) o logger ainda não existe.
    private logger?: VSLogger;

    setLogger(logger: VSLogger): void {
        this.logger = logger;
    }

    private failValidation(issue: v.GenericIssue | undefined, type: VSRepoErrorType, fallbackPath = "options"): never {
        const path = issue?.path?.length ? issue.path.map(p => String(p.key)).join(".") : fallbackPath;
        const message = `${path}: ${issue?.message ?? "validation failed"}`;

        this.logger?.logError(`Validation failed (${type}): ${message}`);

        throw new VSRepoError(message, type);
    }

    private readonly constructorOptionsSchema = v.object({
        // * Usando any ao invés de instanceof para não ter erro de referencia
        adapter: v.any(),
        pkName: v.optional(v.string()),
        softRemoveKey: v.optional(v.string()),
        logLevel: v.optional(v.enum(VSLogLevel)),
        logSlowThresholdMs: v.optional(v.union([v.pipe(v.number(), v.gtValue(0)), v.boolean()])),
        defaultOrdering: v.optional(orderingSchema),
        lazyDynamicMethods: v.optional(v.boolean()),
        vsPlaceholders: v.optional(v.boolean()),
    });

    validateConstructorOptions(options: unknown): VSRepoOptions<T, K> {
        const parsed = v.safeParse(this.constructorOptionsSchema, options);

        if (!parsed.success) {
            this.failValidation(parsed.issues[0], VSRepoErrorType.VALIDATOR);
        }

        return parsed.output as unknown as VSRepoOptions<T, K>;
    }

    private readonly methodOptionsSchema = v.object({
        db: v.optional(v.any()),
        see: v.optional(v.picklist(["active", "removed", "all"])),
        relations: v.optional(relationsSchema),
        select: v.optional(selectSchema),
    });

    validateMethodOptions(options?: unknown): MethodOptions<T, O> {
        const parsed = v.safeParse(this.methodOptionsSchema, options ?? {});

        if (!parsed.success) {
            this.failValidation(parsed.issues[0], VSRepoErrorType.VALIDATOR);
        }

        return parsed.output as MethodOptions<T>;
    }

    private readonly restrictMethodOptionsSchema = v.object({
        db: v.optional(v.any()),
        see: v.optional(v.picklist(["active", "removed", "all"])),
    });

    validateRestrictMethodOptions(options?: unknown): RestrictMethodOptions<T, O> {
        const parsed = v.safeParse(this.restrictMethodOptionsSchema, options ?? {});

        if (!parsed.success) {
            this.failValidation(parsed.issues[0], VSRepoErrorType.VALIDATOR);
        }

        return parsed.output as unknown as RestrictMethodOptions<T, O>;
    }

    private readonly getAllMethodOptionsSchema = v.object({
        ...this.methodOptionsSchema.entries,
        order: v.optional(orderingSchema),
        pagination: v.optional(paginationSchema),
    });

    validateGetAllMethodOptions(options?: unknown): MethodOptions<T, O> & {
        pagination?: Pagination;
        order?: Ordering<T>;
    } {
        const parsed = v.safeParse(this.getAllMethodOptionsSchema, options ?? {});

        if (!parsed.success) {
            this.failValidation(parsed.issues[0], VSRepoErrorType.VALIDATOR);
        }

        return parsed.output as unknown as MethodOptions<T>;
    }

    private queryArgSchema = v.object({
        args: v.optional(v.array(v.any())),
        db: v.optional(v.any()),
    });

    validateQueryMethodArg(arg?: unknown): QueryMethodArg<any[]> {
        const parsed = v.safeParse(this.queryArgSchema, arg ?? {});

        if (!parsed.success) {
            this.failValidation(parsed.issues[0], VSRepoErrorType.VALIDATOR);
        }

        return parsed.output;
    }

    private queryOptionsSchema = v.object({
        args: v.optional(v.array(v.any())),
        db: v.optional(v.any()),
        modifying: v.optional(v.boolean()),
        singleResult: v.optional(v.boolean()),
    });

    validateQueryOptions(options?: unknown): VSRepoQueryOptions {
        const parsed = v.safeParse(this.queryOptionsSchema, options ?? {});

        if (!parsed.success) {
            this.failValidation(parsed.issues[0], VSRepoErrorType.VALIDATOR);
        }

        return parsed.output;
    }

    private transactionOptionsSchema = v.object({
        timeoutMs: v.optional(v.number()),
        isolationLevel: v.optional(v.enum(TransactionIsolationLevel)),
    });

    validateTransactionOptions(options: unknown): VSRepoTransactionOptions {
        const parsed = v.safeParse(this.transactionOptionsSchema, options ?? {});

        if (!parsed.success) {
            this.failValidation(parsed.issues[0], VSRepoErrorType.VALIDATOR);
        }

        return parsed.output;
    }

    validateOrdering(value: unknown): Ordering<T> {
        const parsed = v.safeParse(orderingSchema, value);

        if (!parsed.success) {
            this.failValidation(parsed.issues[0], VSRepoErrorType.VALIDATOR, "ordering");
        }

        return parsed.output as Ordering<T>;
    }

    validatePagination(value: unknown): Pagination {
        const parsed = v.safeParse(paginationSchema, value);

        if (!parsed.success) {
            this.failValidation(parsed.issues[0], VSRepoErrorType.VALIDATOR, "pagination");
        }

        return parsed.output;
    }

    validateWhere(value: unknown): VSRepoWhere<T> {
        const parsed = v.safeParse(whereSchema, value);

        if (!parsed.success) {
            this.failValidation(parsed.issues[0], VSRepoErrorType.VALIDATOR, "where");
        }

        return parsed.output as VSRepoWhere<T>;
    }

    private decimalLikeSchema = v.looseObject({
        toNumber: v.function(),
        decimalPlaces: v.function(),
    });

    private numericLikeSchema = v.union([v.number(), v.bigint(), this.decimalLikeSchema]);

    assertIsNumericLike(value: unknown): asserts value is NumericLike {
        const parsed = v.safeParse(this.numericLikeSchema, value);

        if (!parsed.success) {
            this.failValidation(parsed.issues[0], VSRepoErrorType.VALIDATOR);
        }
    }
}

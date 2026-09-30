import * as v from "valibot";
import { DynamicMethodOptions } from "../../types/decorators/dynamic-method-options.type.js";
import { VSRepoError } from "../../errors/VSRepoError.js";
import orderingSchema from "./schemas/ordering.schema.js";
import { QueryMethodOptions } from "../../types/decorators/query-method-options.type.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";

export class DecoratorsValidator {
    private static readonly dynamicMethodOptionsSchema = v.object({
        proxyTo: v.optional(v.string()),
        injectOrdering: v.optional(orderingSchema),
    });

    static validateDynamicMethodOptions<T>(options: unknown): DynamicMethodOptions<T> {
        const parsed = v.safeParse(this.dynamicMethodOptionsSchema, options ?? {});

        if (!parsed.success) {
            const firstIssue = parsed.issues[0];
            const path = firstIssue.path?.length ? firstIssue.path.map(p => String(p.key)).join(".") : "options";
            throw new VSRepoError(`${path}: ${firstIssue.message}`, VSRepoErrorType.DECORATOR);
        }

        return parsed.output;
    }

    private static queryMethodOptionsSchema = v.object({
        modifying: v.optional(v.boolean(), false),
        singleResult: v.optional(v.boolean()),
        spreadArgs: v.optional(v.boolean()),
    });

    static validateQueryMethodOptions(options: unknown): QueryMethodOptions {
        const parsed = v.safeParse(this.queryMethodOptionsSchema, options ?? {});

        if (!parsed.success) {
            const firstIssue = parsed.issues[0];
            const path = firstIssue.path?.length ? firstIssue.path.map(p => String(p.key)).join(".") : "options";
            throw new VSRepoError(`${path}: ${firstIssue.message}`, VSRepoErrorType.DECORATOR);
        }

        return parsed.output;
    }
}

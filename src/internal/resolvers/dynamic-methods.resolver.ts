import { VSRepoError } from "../../errors/VSRepoError.js";
import { DynamicMethodOptions } from "../../types/decorators/dynamic-method-options.type.js";
import { DynamicMethodCustomization } from "../../types/dynamic-methods/dynamic-method-customization.type.js";
import { DynamicMethodInfo } from "../../types/dynamic-methods/dynamic-method-info.type.js";
import { DynamicMethodWhereOps } from "../../types/dynamic-methods/dynamic-method-where-ops.type.js";
import { Ordering } from "../../types/utils/ordering.type.js";
import { VSRepoArgs } from "../../types/vsrepo/vsrepo-args.type.js";
import { VSRepoMethod } from "../../types/vsrepo/vsrepo-method.type.js";
import { MethodOptions } from "../../types/utils/methods-options.type.js";
import { VSRepoPrettyWhere } from "../../types/vsrepo/vsrepo-pretty-where.type.js";
import { VSRepoQuery } from "../../types/vsrepo/vsrepo-query.type.js";
import { VSRepoResolveArgsData } from "../../types/vsrepo/vsrepo-resolve-args-data.type.js";
import { VSRepoUglyWhere } from "../../types/vsrepo/vsrepo-ugly-where.type.js";
import { VSRepoAdapter } from "../../VSRepoAdapter.js";
import { VSRepository } from "../../VSRepository.js";
import { DYNAMIC_METHODS_KEY } from "../constants/dynamic-methods-key.constant.js";
import { QUERY_METHODS_KEY } from "../constants/query-methods-key.constant.js";
import { VSLogLevel } from "../enums/vs-log-level.enum.js";
import { uncapitalize } from "../utils/uncapitalize.util.js";
import { VSLogger } from "../utils/vs-logger.util.js";
import { VSRepoValidator } from "../validators/vsrepo.validator.js";
import { MergeWheresResolver } from "./merge-wheres.resolver.js";
import merge from "deepmerge";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
import { DEBUG_ARG_SYMBOL } from "../constants/debug-arg-symbol.constant.js";
import { DbArg } from "../utils/db-arg.util.js";
import { VSPlaceholdersParser } from "../utils/vs-placeholder-parser.util.js";

export class DynamicMethodsResolver<T, K> {
    constructor(
        private readonly logger: VSLogger,
        private readonly adapter: VSRepoAdapter<T>,
        private readonly mergeWheresResolver: MergeWheresResolver<T>,
        private readonly validator: VSRepoValidator<T, K>,
        private readonly defaultOrdering?: Ordering<T>,
        private readonly vsPlaceholders: boolean = false,
    ) {}

    private static keywordTemplate = (keyword: string, allowAtTheEnd = false) =>
        new RegExp(`${keyword}(?=[\\p{Lu}]|[^\\p{ASCII}]${allowAtTheEnd ? "|$" : ""})`, "u");

    private static fieldModifiers = {
        IsNull: this.keywordTemplate("IsNull", true),
        IsNotNull: this.keywordTemplate("IsNotNull", true),
        IsTrue: this.keywordTemplate("IsTrue", true),
        IsFalse: this.keywordTemplate("IsFalse", true),
        IgnoreCase: this.keywordTemplate("IgnoreCase", true),
        Optional: this.keywordTemplate("Optional", true),
        NotBetween: this.keywordTemplate("NotBetween", true),
        Between: this.keywordTemplate("Between", true),
        NotStartsWith: this.keywordTemplate("NotStartsWith", true),
        StartsWith: this.keywordTemplate("StartsWith", true),
        NotEndsWith: this.keywordTemplate("NotEndsWith", true),
        EndsWith: this.keywordTemplate("EndsWith", true),
        NotContains: this.keywordTemplate("NotContains", true),
        Contains: this.keywordTemplate("Contains", true),
        LessThanEqual: this.keywordTemplate("LessThanEqual", true),
        LessThan: this.keywordTemplate("LessThan", true),
        GreaterThanEqual: this.keywordTemplate("GreaterThanEqual", true),
        GreaterThan: this.keywordTemplate("GreaterThan", true),
        NotIn: this.keywordTemplate("NotIn", true),
        In: this.keywordTemplate("In", true),
        Not: this.keywordTemplate("Not", true),
        Equals: this.keywordTemplate("Equals", true),
        NotEquals: this.keywordTemplate("NotEquals", true),
        Without: this.keywordTemplate("Without", true),
        With: this.keywordTemplate("With", true),
        Some: this.keywordTemplate("Some", true),
        Every: this.keywordTemplate("Every", true),
        None: this.keywordTemplate("None", true),
    };

    private static operators = {
        And: this.keywordTemplate("And"),
        Or: this.keywordTemplate("Or"),
        AND: this.keywordTemplate("AND"),
    };

    private static customizationModifiers = {
        Distinct: this.keywordTemplate("Distinct"),
        OrderBy: this.keywordTemplate("OrderBy"),
        PaginatedAndOrdered: /PaginatedAndOrdered$/,
        OrderedAndPaginated: /OrderedAndPaginated$/,
        Paginated: /Paginated$/,
        Ordered: /Ordered$/,
        IgnoreConflicts: /IgnoreConflicts$/,
    };

    private logAndThrowError(errorMessage: string): never {
        this.logger.logError(errorMessage);

        throw new VSRepoError(errorMessage, VSRepoErrorType.RESOLVER);
    }

    private validateIndexedArg<R>(args: any[], positionIndex: number, validate: (value: unknown) => R): R {
        const value = args.at(positionIndex);
        if (value === DEBUG_ARG_SYMBOL) {
            return `<args>[${positionIndex < 0 ? args.length + positionIndex : positionIndex}]` as R;
        }

        return validate(value);
    }

    private resolveDynamicMethodInfo(dynamicMethod: string) {
        const dynamicMethodInfo: DynamicMethodInfo = {
            onlyBaseWheres: false,
            ignoreWhere: false,
            ignoreOrderByAndPagination: true,
            ignoreSelect: false,
            keyToMapReplaced: "",
            argsCount: 0,
            method: "unknown",
            existsMode: false,
            ignoreIgnoreConflicts: true,
            ignoreDistinct: true,
            whereParams: [],
            otherParams: [],
            originalDynamicMethodName: dynamicMethod,
        };

        if (dynamicMethod.startsWith("findOneBy")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("findOneBy", "");
            dynamicMethodInfo.ignoreOrderByAndPagination = false;
            dynamicMethodInfo.method = "findOne";
        } else if (dynamicMethod.startsWith("findBy")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("findBy", "");
            dynamicMethodInfo.ignoreOrderByAndPagination = false;
            dynamicMethodInfo.ignoreDistinct = false;
            dynamicMethodInfo.method = "findMany";
        } else if (dynamicMethod.startsWith("findOneOrThrowBy")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("findOneOrThrowBy", "");
            dynamicMethodInfo.ignoreOrderByAndPagination = false;
            dynamicMethodInfo.method = "findOneOrThrow";
        } else if (dynamicMethod.startsWith("findOneOrThrowWhere")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("findOneOrThrowWhere", "");
            dynamicMethodInfo.ignoreOrderByAndPagination = false;
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.whereIndex = 0;
            dynamicMethodInfo.otherParams.push("where");
            dynamicMethodInfo.argsCount += 1;
            dynamicMethodInfo.method = "findOneOrThrow";
        } else if (dynamicMethod.startsWith("findOneOrThrow")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("findOneOrThrow", "");
            dynamicMethodInfo.ignoreOrderByAndPagination = false;
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.method = "findOneOrThrow";
        } else if (dynamicMethod.startsWith("countBy")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("countBy", "");
            dynamicMethodInfo.ignoreOrderByAndPagination = false;
            dynamicMethodInfo.ignoreSelect = true;
            dynamicMethodInfo.method = "count";
        } else if (dynamicMethod.startsWith("countWhere")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("countWhere", "");
            dynamicMethodInfo.ignoreOrderByAndPagination = false;
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.ignoreSelect = true;
            dynamicMethodInfo.method = "count";
            dynamicMethodInfo.whereIndex = 0;
            dynamicMethodInfo.otherParams.push("where");
            dynamicMethodInfo.argsCount += 1;
        } else if (dynamicMethod.startsWith("count")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("count", "");
            dynamicMethodInfo.ignoreOrderByAndPagination = false;
            dynamicMethodInfo.ignoreSelect = true;
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.method = "count";
        } else if (dynamicMethod.startsWith("existsBy")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("existsBy", "");
            dynamicMethodInfo.ignoreSelect = true;
            dynamicMethodInfo.existsMode = true;
            dynamicMethodInfo.method = "exists";
        } else if (dynamicMethod.startsWith("existsWhere")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("existsWhere", "");
            dynamicMethodInfo.ignoreSelect = true;
            dynamicMethodInfo.existsMode = true;
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.method = "exists";
            dynamicMethodInfo.whereIndex = 0;
            dynamicMethodInfo.otherParams.push("where");
            dynamicMethodInfo.argsCount += 1;
        } else if (dynamicMethod.startsWith("createManyReturning")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("createManyReturning", "");
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.ignoreIgnoreConflicts = false;
            dynamicMethodInfo.method = "createManyReturning";
            dynamicMethodInfo.dataIndex = 0;
            dynamicMethodInfo.otherParams.push("data");
            dynamicMethodInfo.argsCount++;
        } else if (dynamicMethod.startsWith("createMany")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("createMany", "");
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.ignoreSelect = true;
            dynamicMethodInfo.ignoreIgnoreConflicts = false;
            dynamicMethodInfo.method = "createMany";
            dynamicMethodInfo.dataIndex = 0;
            dynamicMethodInfo.otherParams.push("data");
            dynamicMethodInfo.argsCount++;
        } else if (dynamicMethod.startsWith("create")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("create", "");
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.method = "create";
            dynamicMethodInfo.dataIndex = 0;
            dynamicMethodInfo.otherParams.push("data");
            dynamicMethodInfo.argsCount++;
        } else if (dynamicMethod.startsWith("updateManyReturningBy")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("updateManyReturningBy", "");
            dynamicMethodInfo.method = "updateManyReturning";
            dynamicMethodInfo.dataIndex = -2;
            dynamicMethodInfo.otherParams.push("data");
            dynamicMethodInfo.argsCount++;
        } else if (dynamicMethod.startsWith("updateManyReturningWhere")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("updateManyReturningWhere", "");
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.method = "updateManyReturning";
            dynamicMethodInfo.dataIndex = -2;
            dynamicMethodInfo.whereIndex = 0;
            dynamicMethodInfo.otherParams.push("where", "data");
            dynamicMethodInfo.argsCount += 2;
        } else if (dynamicMethod.startsWith("updateManyBy")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("updateManyBy", "");
            dynamicMethodInfo.ignoreSelect = true;
            dynamicMethodInfo.method = "updateMany";
            dynamicMethodInfo.dataIndex = -2;
            dynamicMethodInfo.otherParams.push("data");
            dynamicMethodInfo.argsCount++;
        } else if (dynamicMethod.startsWith("updateManyWhere")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("updateManyWhere", "");
            dynamicMethodInfo.ignoreSelect = true;
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.method = "updateMany";
            dynamicMethodInfo.dataIndex = -2;
            dynamicMethodInfo.whereIndex = 0;
            dynamicMethodInfo.otherParams.push("where", "data");
            dynamicMethodInfo.argsCount += 2;
        } else if (dynamicMethod.startsWith("updateBy")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("updateBy", "");
            dynamicMethodInfo.method = "update";
            dynamicMethodInfo.dataIndex = -2;
            dynamicMethodInfo.otherParams.push("data");
            dynamicMethodInfo.argsCount++;
        } else if (dynamicMethod.startsWith("updateWhere")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("updateWhere", "");
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.method = "update";
            dynamicMethodInfo.dataIndex = -2;
            dynamicMethodInfo.whereIndex = 0;
            dynamicMethodInfo.otherParams.push("where", "data");
            dynamicMethodInfo.argsCount += 2;
        } else if (dynamicMethod.startsWith("upsertBy")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("upsertBy", "");
            dynamicMethodInfo.method = "upsert";
            dynamicMethodInfo.createIndex = -3;
            dynamicMethodInfo.updateIndex = -2;
            dynamicMethodInfo.otherParams.push("create", "update");
            dynamicMethodInfo.argsCount += 2;
        } else if (dynamicMethod.startsWith("upsertWhere")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("upsertWhere", "");
            dynamicMethodInfo.method = "upsert";
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.createIndex = -3;
            dynamicMethodInfo.updateIndex = -2;
            dynamicMethodInfo.whereIndex = 0;
            dynamicMethodInfo.otherParams.push("where", "create", "update");
            dynamicMethodInfo.argsCount += 3;
        } else if (dynamicMethod.startsWith("deleteManyReturningBy")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("deleteManyReturningBy", "");
            dynamicMethodInfo.method = "deleteManyReturning";
        } else if (dynamicMethod.startsWith("deleteManyReturningWhere")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("deleteManyReturningWhere", "");
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.method = "deleteManyReturning";
            dynamicMethodInfo.whereIndex = 0;
            dynamicMethodInfo.otherParams.push("where");
            dynamicMethodInfo.argsCount += 1;
        } else if (dynamicMethod.startsWith("deleteManyBy")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("deleteManyBy", "");
            dynamicMethodInfo.ignoreSelect = true;
            dynamicMethodInfo.method = "deleteMany";
        } else if (dynamicMethod.startsWith("deleteManyWhere")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("deleteManyWhere", "");
            dynamicMethodInfo.ignoreSelect = true;
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.method = "deleteMany";
            dynamicMethodInfo.whereIndex = 0;
            dynamicMethodInfo.otherParams.push("where");
            dynamicMethodInfo.argsCount += 1;
        } else if (dynamicMethod.startsWith("deleteBy")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("deleteBy", "");
            dynamicMethodInfo.method = "delete";
        } else if (dynamicMethod.startsWith("deleteWhere")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("deleteWhere", "");
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.whereIndex = 0;
            dynamicMethodInfo.otherParams.push("where");
            dynamicMethodInfo.argsCount += 1;
            dynamicMethodInfo.method = "delete";
        } else if (dynamicMethod.startsWith("findWhere")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("findWhere", "");
            dynamicMethodInfo.ignoreOrderByAndPagination = false;
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.ignoreDistinct = false;
            dynamicMethodInfo.method = "findMany";
            dynamicMethodInfo.whereIndex = 0;
            dynamicMethodInfo.otherParams.push("where");
            dynamicMethodInfo.argsCount += 1;
        } else if (dynamicMethod.startsWith("findOneWhere")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("findOneWhere", "");
            dynamicMethodInfo.ignoreOrderByAndPagination = false;
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.method = "findOne";
            dynamicMethodInfo.whereIndex = 0;
            dynamicMethodInfo.otherParams.push("where");
            dynamicMethodInfo.argsCount += 1;
        } else if (dynamicMethod.startsWith("findOne")) {
            dynamicMethodInfo.keyToMapReplaced = dynamicMethod.replace("findOne", "");
            dynamicMethodInfo.ignoreOrderByAndPagination = false;
            dynamicMethodInfo.ignoreWhere = true;
            dynamicMethodInfo.onlyBaseWheres = true;
            dynamicMethodInfo.method = "findOne";
        } else {
            this.logAndThrowError(`Unknown dynamic method: ${dynamicMethod}.`);
        }

        return dynamicMethodInfo;
    }

    private resolveDynamicMethodCustomization(
        dynamicMethodInfo: DynamicMethodInfo,
        methodData: DynamicMethodOptions<T>,
    ) {
        const dynamicMethodCustomization: DynamicMethodCustomization = {};

        if (!dynamicMethodInfo.ignoreIgnoreConflicts) {
            if (
                DynamicMethodsResolver.customizationModifiers.IgnoreConflicts.test(dynamicMethodInfo.keyToMapReplaced)
            ) {
                dynamicMethodInfo.keyToMapReplaced = dynamicMethodInfo.keyToMapReplaced.replace(
                    DynamicMethodsResolver.customizationModifiers.IgnoreConflicts,
                    "",
                );
                dynamicMethodCustomization.ignoreConflicts = true;
            }
        } else if (
            DynamicMethodsResolver.customizationModifiers.IgnoreConflicts.test(dynamicMethodInfo.keyToMapReplaced)
        ) {
            this.logAndThrowError(
                `This dynamic method prefix doesn't support the "IgnoreConflicts" modifier: ${dynamicMethodInfo.originalDynamicMethodName}.`,
            );
        }

        if (!dynamicMethodInfo.ignoreOrderByAndPagination) {
            if (
                DynamicMethodsResolver.customizationModifiers.PaginatedAndOrdered.test(
                    dynamicMethodInfo.keyToMapReplaced,
                )
            ) {
                dynamicMethodCustomization.orderPosition = -2;
                dynamicMethodCustomization.paginationPosition = -3;

                dynamicMethodInfo.otherParams.push("pagination");
                dynamicMethodInfo.otherParams.push("order");

                dynamicMethodInfo.keyToMapReplaced = dynamicMethodInfo.keyToMapReplaced.replace(
                    DynamicMethodsResolver.customizationModifiers.PaginatedAndOrdered,
                    "",
                );

                dynamicMethodInfo.argsCount += 2;
            } else if (
                DynamicMethodsResolver.customizationModifiers.OrderedAndPaginated.test(
                    dynamicMethodInfo.keyToMapReplaced,
                )
            ) {
                dynamicMethodCustomization.orderPosition = -3;
                dynamicMethodCustomization.paginationPosition = -2;

                dynamicMethodInfo.otherParams.push("order");
                dynamicMethodInfo.otherParams.push("pagination");

                dynamicMethodInfo.keyToMapReplaced = dynamicMethodInfo.keyToMapReplaced.replace(
                    DynamicMethodsResolver.customizationModifiers.OrderedAndPaginated,
                    "",
                );

                dynamicMethodInfo.argsCount += 2;
            } else if (
                DynamicMethodsResolver.customizationModifiers.Paginated.test(dynamicMethodInfo.keyToMapReplaced)
            ) {
                dynamicMethodCustomization.paginationPosition = -2;

                dynamicMethodInfo.otherParams.push("pagination");

                dynamicMethodInfo.keyToMapReplaced = dynamicMethodInfo.keyToMapReplaced.replace(
                    DynamicMethodsResolver.customizationModifiers.Paginated,
                    "",
                );

                dynamicMethodInfo.argsCount++;
            } else if (DynamicMethodsResolver.customizationModifiers.Ordered.test(dynamicMethodInfo.keyToMapReplaced)) {
                dynamicMethodCustomization.orderPosition = -2;

                dynamicMethodInfo.otherParams.push("order");

                dynamicMethodInfo.keyToMapReplaced = dynamicMethodInfo.keyToMapReplaced.replace(
                    DynamicMethodsResolver.customizationModifiers.Ordered,
                    "",
                );

                dynamicMethodInfo.argsCount++;
            }

            const keySplitedOrderBy = dynamicMethodInfo.keyToMapReplaced.split(
                DynamicMethodsResolver.customizationModifiers.OrderBy,
            );

            if (keySplitedOrderBy[1]) {
                if (DynamicMethodsResolver.customizationModifiers.Distinct.test(keySplitedOrderBy[1])) {
                    this.logAndThrowError(
                        `The "Distinct" modifier cannot appear after the "OrderBy" modifier: ${dynamicMethodInfo.originalDynamicMethodName}.`,
                    );
                }

                const orderByFields = keySplitedOrderBy[1]
                    .split(DynamicMethodsResolver.operators.And)
                    .map(uncapitalize);

                dynamicMethodCustomization.injectOrdering = orderByFields.map(field => {
                    if (field.endsWith("Asc")) {
                        field = field.replace(/Asc$/, "");
                        return { [field]: "ASC" };
                    } else if (field.endsWith("Desc")) {
                        field = field.replace(/Desc$/, "");
                        return { [field]: "DESC" };
                    }

                    return { [field]: "ASC" };
                });
            }

            dynamicMethodInfo.keyToMapReplaced = keySplitedOrderBy[0]!;

            dynamicMethodCustomization.injectOrdering ??= methodData.injectOrdering;
        } else if (
            DynamicMethodsResolver.customizationModifiers.Paginated.test(dynamicMethodInfo.keyToMapReplaced) ||
            DynamicMethodsResolver.customizationModifiers.Ordered.test(dynamicMethodInfo.keyToMapReplaced) ||
            DynamicMethodsResolver.customizationModifiers.OrderBy.test(dynamicMethodInfo.keyToMapReplaced)
        ) {
            this.logAndThrowError(
                `This dynamic method prefix doesn't support the ordering or pagination modifiers: ${dynamicMethodInfo.originalDynamicMethodName}.`,
            );
        }

        if (!dynamicMethodInfo.ignoreDistinct) {
            const keySplitedDistinct = dynamicMethodInfo.keyToMapReplaced.split(
                DynamicMethodsResolver.customizationModifiers.Distinct,
            );

            if (keySplitedDistinct[1]) {
                dynamicMethodCustomization.distinctKeys = keySplitedDistinct[1]
                    .split(DynamicMethodsResolver.operators.And)
                    .map(uncapitalize);
            }

            dynamicMethodInfo.keyToMapReplaced = keySplitedDistinct[0]!;
        } else if (DynamicMethodsResolver.customizationModifiers.Distinct.test(dynamicMethodInfo.keyToMapReplaced)) {
            this.logAndThrowError(
                `This dynamic method prefix doesn't support the "Distinct" modifier: ${dynamicMethodInfo.originalDynamicMethodName}.`,
            );
        }

        return dynamicMethodCustomization;
    }

    private resolveUglyWhere(keySplitedAnd: string) {
        const uglyWhere: VSRepoUglyWhere = { name: "", pushProperty: "$$$" };
        let nullMode: "is" | "not" | undefined = undefined;

        if (DynamicMethodsResolver.fieldModifiers.IsNull.test(keySplitedAnd)) {
            uglyWhere.pushProperty = "$$$";
            uglyWhere.autoInjectVal = null;
            nullMode = "is";
            keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.IsNull, "");
        } else if (DynamicMethodsResolver.fieldModifiers.IsNotNull.test(keySplitedAnd)) {
            uglyWhere.pushProperty = "not";
            uglyWhere.autoInjectVal = null;
            nullMode = "not";
            keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.IsNotNull, "");
        } else if (DynamicMethodsResolver.fieldModifiers.IsTrue.test(keySplitedAnd)) {
            uglyWhere.pushProperty = "$$$";
            uglyWhere.autoInjectVal = true;
            keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.IsTrue, "");
        } else if (DynamicMethodsResolver.fieldModifiers.IsFalse.test(keySplitedAnd)) {
            uglyWhere.pushProperty = "$$$";
            uglyWhere.autoInjectVal = false;
            keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.IsFalse, "");
        } else {
            if (DynamicMethodsResolver.fieldModifiers.IgnoreCase.test(keySplitedAnd)) {
                uglyWhere.properties = {};
                uglyWhere.properties.ignoreCase = true;
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.IgnoreCase, "");
            }
            if (DynamicMethodsResolver.fieldModifiers.Optional.test(keySplitedAnd)) {
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.Optional, "");
            }

            if (DynamicMethodsResolver.fieldModifiers.NotBetween.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "not";
                uglyWhere.betweenMode = true;
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.NotBetween, "");
            } else if (DynamicMethodsResolver.fieldModifiers.Between.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "$$$";
                uglyWhere.betweenMode = true;
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.Between, "");
            } else if (DynamicMethodsResolver.fieldModifiers.NotStartsWith.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "not.startsWith";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.NotStartsWith, "");
            } else if (DynamicMethodsResolver.fieldModifiers.StartsWith.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "startsWith";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.StartsWith, "");
            } else if (DynamicMethodsResolver.fieldModifiers.NotEndsWith.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "not.endsWith";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.NotEndsWith, "");
            } else if (DynamicMethodsResolver.fieldModifiers.EndsWith.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "endsWith";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.EndsWith, "");
            } else if (DynamicMethodsResolver.fieldModifiers.NotContains.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "not.contains";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.NotContains, "");
            } else if (DynamicMethodsResolver.fieldModifiers.Contains.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "contains";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.Contains, "");
            } else if (DynamicMethodsResolver.fieldModifiers.NotEquals.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "not";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.NotEquals, "");
            } else if (DynamicMethodsResolver.fieldModifiers.Equals.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "$$$";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.Equals, "");
            } else if (DynamicMethodsResolver.fieldModifiers.LessThanEqual.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "lte";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.LessThanEqual, "");
            } else if (DynamicMethodsResolver.fieldModifiers.LessThan.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "lt";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.LessThan, "");
            } else if (DynamicMethodsResolver.fieldModifiers.GreaterThanEqual.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "gte";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.GreaterThanEqual, "");
            } else if (DynamicMethodsResolver.fieldModifiers.GreaterThan.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "gt";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.GreaterThan, "");
            } else if (DynamicMethodsResolver.fieldModifiers.NotIn.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "notIn";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.NotIn, "");
            } else if (DynamicMethodsResolver.fieldModifiers.In.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "in";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.In, "");
            } else if (DynamicMethodsResolver.fieldModifiers.Not.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "not";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.Not, "");
            } else {
                uglyWhere.pushProperty = "$$$";
            }
        }

        if (DynamicMethodsResolver.fieldModifiers.Without.test(keySplitedAnd)) {
            const keySplitedConector = keySplitedAnd.split(DynamicMethodsResolver.fieldModifiers.Without);
            const specificField = keySplitedConector[1];
            if (!specificField) {
                if (nullMode) {
                    uglyWhere.pushProperty = nullMode === "not" ? "_with" : "_without";
                } else {
                    uglyWhere.pushProperty = "_without";
                    uglyWhere.autoInjectVal = {};
                }
            } else {
                uglyWhere.pushProperty = `_without.${uncapitalize(specificField)}${uglyWhere.pushProperty === "$$$" ? (uglyWhere.properties ? ".equals" : "") : `.${uglyWhere.pushProperty}`}`;
            }

            keySplitedAnd = keySplitedConector[0]!;
        } else if (DynamicMethodsResolver.fieldModifiers.With.test(keySplitedAnd)) {
            const keySplitedConector = keySplitedAnd.split(DynamicMethodsResolver.fieldModifiers.With);
            const specificField = keySplitedConector[1];
            if (!specificField) {
                if (nullMode) {
                    uglyWhere.pushProperty = nullMode === "not" ? "_without" : "_with";
                } else {
                    uglyWhere.pushProperty = "_with";
                    uglyWhere.autoInjectVal = {};
                }
            } else {
                uglyWhere.pushProperty = `_with.${uncapitalize(specificField)}${uglyWhere.pushProperty === "$$$" ? (uglyWhere.properties ? ".equals" : "") : `.${uglyWhere.pushProperty}`}`;
            }

            keySplitedAnd = keySplitedConector[0]!;
        } else if (DynamicMethodsResolver.fieldModifiers.Some.test(keySplitedAnd)) {
            const keySplitedConector = keySplitedAnd.split(DynamicMethodsResolver.fieldModifiers.Some);
            const specificField = keySplitedConector[1];
            if (!specificField) {
                uglyWhere.pushProperty = "_some";
                uglyWhere.autoInjectVal = {};
            } else {
                uglyWhere.pushProperty = `_some.${uncapitalize(specificField)}${uglyWhere.pushProperty === "$$$" ? (uglyWhere.properties ? ".equals" : "") : `.${uglyWhere.pushProperty}`}`;
            }

            keySplitedAnd = keySplitedConector[0]!;
        } else if (DynamicMethodsResolver.fieldModifiers.Every.test(keySplitedAnd)) {
            const keySplitedConector = keySplitedAnd.split(DynamicMethodsResolver.fieldModifiers.Every);
            const specificField = keySplitedConector[1];
            if (!specificField) {
                uglyWhere.pushProperty = "_every";
                uglyWhere.autoInjectVal = {};
            } else {
                uglyWhere.pushProperty = `_every.${uncapitalize(specificField)}${uglyWhere.pushProperty === "$$$" ? (uglyWhere.properties ? ".equals" : "") : `.${uglyWhere.pushProperty}`}`;
            }

            keySplitedAnd = keySplitedConector[0]!;
        } else if (DynamicMethodsResolver.fieldModifiers.None.test(keySplitedAnd)) {
            const keySplitedConector = keySplitedAnd.split(DynamicMethodsResolver.fieldModifiers.None);
            const specificField = keySplitedConector[1];
            if (!specificField) {
                uglyWhere.pushProperty = "_none";
                uglyWhere.autoInjectVal = {};
            } else {
                uglyWhere.pushProperty = `_none.${uncapitalize(specificField)}${uglyWhere.pushProperty === "$$$" ? (uglyWhere.properties ? ".equals" : "") : `.${uglyWhere.pushProperty}`}`;
            }

            keySplitedAnd = keySplitedConector[0]!;
        }

        keySplitedAnd = uncapitalize(keySplitedAnd);

        uglyWhere.name = keySplitedAnd;

        return uglyWhere;
    }

    private resolvePrettyWheres(dynamicMethodInfo: DynamicMethodInfo): DynamicMethodWhereOps {
        const dynamicMethodWhereOps: DynamicMethodWhereOps = {
            uglyWheres: [],
            prettyWheres: [],
        };

        let ANDMode = false;
        let keysSplitedAND = dynamicMethodInfo.keyToMapReplaced.split(DynamicMethodsResolver.operators.AND);
        if (keysSplitedAND.length > 1) {
            ANDMode = true;
        }

        keysSplitedAND.forEach((keySplitedAND, idx) => {
            let orMode = false;
            let keysSplitedOr: string[];

            if (idx === 0) {
                keysSplitedOr = keySplitedAND.split(DynamicMethodsResolver.operators.Or);
            } else {
                if (DynamicMethodsResolver.operators.Or.test(keySplitedAND)) {
                    this.logAndThrowError(
                        `The logical operator "Or" cannot appear after an "AND" (all caps): ${dynamicMethodInfo.originalDynamicMethodName}.`,
                    );
                }
                keysSplitedOr = [keySplitedAND];
            }

            if (keysSplitedOr.length > 1) {
                orMode = true;
            }

            for (let i = 0; i < keysSplitedOr.length; i++) {
                if (keysSplitedOr[i] === "") continue;

                const keysSplitedAnd = keysSplitedOr[i]!.split(DynamicMethodsResolver.operators.And);

                for (const keySplitedAnd of keysSplitedAnd) {
                    if (keySplitedAnd === "") continue;

                    const uglyWhere = this.resolveUglyWhere(keySplitedAnd);

                    if (!orMode) {
                        if (idx === 1 && ANDMode) {
                            uglyWhere.name = `AND.${i}idx.${uglyWhere.name}`;
                        }
                        dynamicMethodWhereOps.uglyWheres.push(uglyWhere);
                    } else {
                        uglyWhere.name = `OR.${i}idx.${uglyWhere.name}`;
                        dynamicMethodWhereOps.uglyWheres.push(uglyWhere);
                    }

                    if (uglyWhere.autoInjectVal === undefined) dynamicMethodInfo.argsCount++;
                }
            }
        });

        const prettyWheres: VSRepoPrettyWhere[] = dynamicMethodWhereOps.uglyWheres.map(arg => {
            let context: (string | number)[] = [];
            let otherProps: { ignoreCase?: boolean } | undefined = undefined;

            let argName = arg.name;
            const agrNameSplitedOr = argName.split("OR.");
            if (agrNameSplitedOr.length > 1) {
                const agrNameSplitedOrIdx = agrNameSplitedOr[1]!.split("idx.");
                context.push("OR");
                context.push(Number(agrNameSplitedOrIdx[0]));
                argName = agrNameSplitedOrIdx[1]!;
            } else {
                const agrNameSplitedAND = argName.split("AND.");
                if (agrNameSplitedAND.length > 1) {
                    const agrNameSplitedANDIdx = agrNameSplitedAND[1]!.split("idx.");
                    context.push("AND");
                    context.push(Number(agrNameSplitedANDIdx[0]));
                    argName = agrNameSplitedANDIdx[1]!;
                }
            }

            context.push(argName);
            if (arg.pushProperty !== "$$$") {
                const pushProperty = arg.pushProperty;
                const pushPropertySplitedDot = pushProperty.split(".");

                pushPropertySplitedDot.forEach(prop => context.push(prop));
            }

            if (arg.properties !== undefined) {
                const propertiesKeys = Object.keys(arg.properties);
                otherProps = {};
                for (let i = 0; i < propertiesKeys.length; i++) {
                    const key = propertiesKeys[i] as "ignoreCase";
                    otherProps[key] = arg.properties[key];
                }
                if (arg.pushProperty === "$$$") {
                    context.push("equals");
                }
            }

            dynamicMethodInfo.whereParams.push(argName);
            return {
                context,
                otherProps,
                argName,
                autoVal: arg.autoInjectVal,
                betweenMode: arg.betweenMode,
            };
        });

        dynamicMethodWhereOps.prettyWheres = prettyWheres;

        return dynamicMethodWhereOps;
    }

    private resolveVSRepoArgs(data: VSRepoResolveArgsData<T, K>): VSRepoArgs<T> {
        const {
            instance: _,
            options,
            withoutSelect,
            withoutWhere,
            specificSelect,
            dataPayload,
            createPayload,
            updatePayload,
            specificWhere,
            ordering,
            pagination,
            withOrderingAndPagination,
            ignoreConflicts,
            distinctKeys,
        } = data;

        // console.log(this.adapter)

        const vsrepoArgs: VSRepoArgs<T> = {};
        vsrepoArgs.options = { db: options.db ?? this.adapter.getDbClient() };

        if (!withoutWhere) {
            vsrepoArgs.where =
                // * Validação necessária para o DEBUG MODE
                typeof specificWhere === "string"
                    ? specificWhere
                    : this.mergeWheresResolver.resolve(options.see, specificWhere);
        }

        if (!withoutSelect) {
            vsrepoArgs.options.select = specificSelect ?? options.select;
            vsrepoArgs.options.relations = options.relations;
        }

        if (dataPayload) {
            vsrepoArgs.obj = dataPayload;
        }

        if (createPayload) {
            vsrepoArgs.create = createPayload;
        }

        if (updatePayload) {
            vsrepoArgs.update = updatePayload;
        }

        if (withOrderingAndPagination) {
            if (ordering) {
                vsrepoArgs.options.order = ordering;
            }

            if (pagination) {
                vsrepoArgs.options.pagination = pagination;
            }
        }

        if (ignoreConflicts !== undefined) {
            // * Usado no createMany
            (vsrepoArgs.options as any).ignoreConflicts = ignoreConflicts;
        }

        if (distinctKeys !== undefined) {
            // * Usado no findMany
            (vsrepoArgs.options as any).distinct = distinctKeys;
        }

        return vsrepoArgs;
    }

    private resolveSpecificWhere(args: any[], prettyWheres: VSRepoPrettyWhere[]) {
        let specificWhere: Record<string, any> = {};
        let OR: any[] | undefined;
        let AND: any[] | undefined;

        let adjust = 0;
        for (let j = 0; j < prettyWheres.length; j++) {
            let path: Record<string, any> = {};
            let current = path;
            let ormode = false;
            let andmode = false;
            let modeIdx: number;
            const currentWhereRslvd = prettyWheres[j]!;
            const context = currentWhereRslvd.context;
            const contextLength = context.length;
            const contextLengthM1 = contextLength - 1;
            for (let i = 0; i < contextLength; i++) {
                if (i < contextLengthM1) {
                    if (context[i] === "OR") {
                        ormode = true;
                    } else if (context[i] === "AND") {
                        andmode = true;
                    } else if (typeof context[i] === "number") {
                        modeIdx = context[i] as number;
                    } else {
                        if (!current[context[i]!]) current[context[i]!] = {};
                        current = current[context[i]!];
                    }
                } else {
                    if (currentWhereRslvd.autoVal !== undefined) {
                        current[context[i]!] = currentWhereRslvd.autoVal;
                        adjust++;

                        continue;
                    }

                    const arg = args[j - adjust] === DEBUG_ARG_SYMBOL ? `<args>[${j - adjust}]` : args[j - adjust];

                    // ? Avaliar necessidade dessa validação; era usada por compatibilidade direta com o prisma
                    if (currentWhereRslvd.betweenMode && arg !== undefined) {
                        current[context[i]!] = { between: arg };
                        // current[context[i]!]["gte"] = arg[0];
                        // current[context[i]!]["lte"] = arg[1];
                    } else {
                        current[context[i]!] = arg;
                    }
                }
            }

            if (currentWhereRslvd.otherProps !== undefined) {
                Object.assign(current, currentWhereRslvd.otherProps);
            }

            if (ormode) {
                if (!OR) OR = [];
                if (!OR[modeIdx!]) OR[modeIdx!] = {};
                OR[modeIdx!] = merge(OR[modeIdx!], path);
                // Object.assign(OR[modeIdx!], path);
            } else if (andmode) {
                if (!AND) AND = [];
                if (!AND[modeIdx!]) AND[modeIdx!] = {};
                AND[modeIdx!] = merge(AND[modeIdx!], path);
                // Object.assign(AND[modeIdx!], path);
            } else {
                specificWhere = merge(specificWhere, path);
                // Object.assign(specificWhere, path);
            }
        }

        if (OR) specificWhere.OR = OR.filter(x => x !== undefined);
        if (AND) specificWhere.AND = AND.filter(x => x !== undefined);

        return specificWhere;
    }

    resolve(instance: VSRepository<T, K, any>): number {
        const dynamicMethods: VSRepoMethod<T>[] =
            Reflect.getMetadata(DYNAMIC_METHODS_KEY, instance.constructor.prototype) ?? [];

        this.logger.logDebug(`Resolving ${dynamicMethods.length} dynamic method(s):`, dynamicMethods);

        for (const method of dynamicMethods) {
            if (typeof method.propertyKey === "symbol") {
                const errorMessage = `The propertyKey must be a string`;
                this.logger.logError(errorMessage);

                throw new VSRepoError(errorMessage, VSRepoErrorType.RESOLVER);
            }

            const originalKey = method.propertyKey;
            const methodToMap = method.proxyTo ?? originalKey;

            const dynamicMethodInfo = this.resolveDynamicMethodInfo(methodToMap);

            const dynamicMethodCustomization = this.resolveDynamicMethodCustomization(dynamicMethodInfo, method);

            let dynamicMethodWhereOps: DynamicMethodWhereOps = {
                uglyWheres: [],
                prettyWheres: [],
            };

            if (!dynamicMethodInfo.ignoreWhere) {
                dynamicMethodWhereOps = this.resolvePrettyWheres(dynamicMethodInfo);
            }

            instance._vsrepocache.set(originalKey, (args, methodOptions) => {
                const vsrepoResolveArgsData: VSRepoResolveArgsData<T, K> = {
                    instance,
                    options: methodOptions ?? {},
                    withoutWhere: dynamicMethodInfo.ignoreWhere && !dynamicMethodInfo.onlyBaseWheres,
                    specificSelect: undefined, // ? Avaliar quando vai precisar
                    withoutSelect: dynamicMethodInfo.ignoreSelect,
                    ignoreConflicts: dynamicMethodCustomization.ignoreConflicts,
                    ordering:
                        dynamicMethodCustomization.orderPosition !== undefined
                            ? this.validateIndexedArg(args, dynamicMethodCustomization.orderPosition, value =>
                                  this.validator.validateOrdering(value),
                              )
                            : (dynamicMethodCustomization.injectOrdering ?? this.defaultOrdering),
                    pagination:
                        dynamicMethodCustomization.paginationPosition !== undefined
                            ? this.validateIndexedArg(args, dynamicMethodCustomization.paginationPosition, value =>
                                  this.validator.validatePagination(value),
                              )
                            : undefined,
                    dataPayload:
                        dynamicMethodInfo.dataIndex !== undefined ? args.at(dynamicMethodInfo.dataIndex) : undefined,
                    createPayload:
                        dynamicMethodInfo.createIndex !== undefined
                            ? args.at(dynamicMethodInfo.createIndex)
                            : undefined,
                    updatePayload:
                        dynamicMethodInfo.updateIndex !== undefined
                            ? args.at(dynamicMethodInfo.updateIndex)
                            : undefined,
                    withOrderingAndPagination: !dynamicMethodInfo.ignoreOrderByAndPagination,
                    distinctKeys: dynamicMethodCustomization.distinctKeys,
                };

                if (!dynamicMethodInfo.ignoreWhere) {
                    vsrepoResolveArgsData.specificWhere = this.resolveSpecificWhere(
                        args,
                        dynamicMethodWhereOps.prettyWheres,
                    );
                } else if (dynamicMethodInfo.onlyBaseWheres) {
                    vsrepoResolveArgsData.specificWhere =
                        dynamicMethodInfo.whereIndex !== undefined
                            ? this.validateIndexedArg(args, dynamicMethodInfo.whereIndex, value =>
                                  this.validator.validateWhere(value),
                              )
                            : {};
                }

                return this.resolveVSRepoArgs(vsrepoResolveArgsData);
            });

            // * If para evitar cálculo desnecessário
            if (this.logger.getLogLevel() === VSLogLevel.DEBUG) {
                const argsSimulation: (typeof DEBUG_ARG_SYMBOL)[] = [];

                for (let i = 0; i <= dynamicMethodInfo.argsCount; i++) {
                    argsSimulation.push(DEBUG_ARG_SYMBOL);
                }

                const vsrepoArgs = instance._vsrepocache.get(originalKey)!(argsSimulation);

                const { db: _, ...options } = vsrepoArgs.options ?? {};

                this.logger.logDebug(`Args preview for ${originalKey}:`, {
                    ...vsrepoArgs,
                    options,
                });
            }

            (instance as any)[originalKey] = async (...args: any[]) => {
                let methodOptions: MethodOptions<T> | undefined;

                if (args.length < dynamicMethodInfo.argsCount) {
                    const missingParams = dynamicMethodInfo.whereParams
                        .concat(dynamicMethodInfo.otherParams)
                        .slice(args.length);

                    const errorMessage = `Missing parameters: ${missingParams.join(", ")}`;
                    this.logger.logError(`Cannot run '${originalKey}': ${errorMessage}`);

                    throw new VSRepoError(errorMessage, VSRepoErrorType.DYNAMIC);
                } else if (args.length > dynamicMethodInfo.argsCount) {
                    const optionsArg = args[dynamicMethodInfo.argsCount];
                    methodOptions = this.validator.validateMethodOptions(optionsArg);
                } else {
                    args.push("1");
                }

                args = args.slice(0, dynamicMethodInfo.argsCount + 1);

                const vsrepoArgs = instance._vsrepocache.get(originalKey)!(args, methodOptions);

                const start = this.logger.startPerformLog(
                    `run ${String(originalKey)} (-> ${dynamicMethodInfo.method})`,
                );

                try {
                    // * Todos os métodos do adapter seguem essa precedencia de parametros
                    const argsOrdered: any[] = [
                        vsrepoArgs.where,
                        vsrepoArgs.obj,
                        vsrepoArgs.create,
                        vsrepoArgs.update,
                        vsrepoArgs.options,
                    ].filter(arg => arg !== undefined);

                    const result = await (this.adapter as any)[dynamicMethodInfo.method](...argsOrdered);

                    this.logger.endPerformLog(start);

                    return result;
                } catch (err) {
                    this.logger.endPerformLog(start);
                    // this.logger.logError(
                    //     `Failed to run dynamic method '${String(originalKey)}' (-> ${dynamicMethodInfo.method})`,
                    //     err,
                    // );

                    throw err;
                }
            };
        }

        return dynamicMethods.length;
    }

    resolveQueries(instance: VSRepository<T, K, any>): number {
        const queryMethods: VSRepoQuery[] =
            Reflect.getMetadata(QUERY_METHODS_KEY, instance.constructor.prototype) ?? [];

        this.logger.logDebug(`Resolving ${queryMethods.length} query method(s):`, queryMethods);

        for (const method of queryMethods) {
            const originalKey = method.propertyKey;

            const modifyingQueryMethod = method.modifying ?? false;
            const valueQueryMethod = method.value;
            const singleResult = method.singleResult ?? false;
            const spreadArgsMode = method.spreadArgs;

            (instance as any)[originalKey] = async (...args: unknown[]) => {
                let db: any;
                let queryArgs: any[] | undefined;

                if (spreadArgsMode) {
                    const dbPos = args.at(-1);
                    if (dbPos instanceof DbArg) {
                        db = dbPos.getDb();
                        queryArgs = args.slice(0, -1);
                    } else {
                        queryArgs = args;
                    }
                } else {
                    if (args.length > 1) {
                        const errorMessage = `This query method was declared without spreadArgs = true, use a single QueryMethodArg instead`;
                        this.logger.logError(`Cannot run '${String(originalKey)}': ${errorMessage}`);

                        throw new VSRepoError(errorMessage, VSRepoErrorType.DYNAMIC);
                    }
                    const queryArgValidated = this.validator.validateQueryMethodArg(args[0]);
                    db = queryArgValidated.db;
                    queryArgs = queryArgValidated.args;
                }

                db ??= this.adapter.getDbClient();

                let finalQuery = valueQueryMethod;
                let finalArgs = queryArgs;

                if (this.vsPlaceholders) {
                    const compiled = VSPlaceholdersParser.parse(valueQueryMethod, queryArgs ?? []).compile(index =>
                        this.adapter.getPlaceholder(index),
                    );
                    finalQuery = compiled.text;
                    finalArgs = compiled.args;
                }

                this.logger.logDebug(`QueryMethod '${String(originalKey)}':`, {
                    query: finalQuery,
                    args: finalArgs ?? [],
                    modifying: modifyingQueryMethod,
                    singleResult,
                });

                const start = this.logger.startPerformLog(
                    `run ${String(originalKey)} (Modifying: ${modifyingQueryMethod})`,
                );

                try {
                    const result = await this.adapter.query(finalQuery, {
                        db,
                        args: finalArgs,
                        modifying: modifyingQueryMethod,
                    });

                    const resolved = singleResult && Array.isArray(result) ? (result[0] ?? null) : result;

                    this.logger.endPerformLog(start);

                    return resolved;
                } catch (err) {
                    this.logger.endPerformLog(start);
                    // this.logger.logError(
                    //     `Failed to run query method '${String(originalKey)}'`,
                    //     err,
                    // );

                    throw err;
                }
            };
        }

        return queryMethods.length;
    }
}

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
        private readonly defaultOrdering?: Ordering<T>,
        private readonly vsPlaceholders: boolean = true,
    ) {}

    private static keywordTemplate = (keyword: string, allowAtTheEnd = false, allowIs = false, requirePrefix = false) =>
        new RegExp(
            `${requirePrefix ? "(?<!^)" : ""}${allowIs ? "(?:Is)?" : ""}${keyword}(?=[\\p{Lu}]|[^\\p{ASCII}]${allowAtTheEnd ? "|$" : ""})`,
            "u",
        );

    private static fieldModifiers = {
        IsNull: this.keywordTemplate("Null", true, true),
        IsNotNull: this.keywordTemplate("NotNull", true, true),
        IsTrue: this.keywordTemplate("True", true, true),
        IsFalse: this.keywordTemplate("False", true, true),
        IgnoreCase: this.keywordTemplate("(IgnoreCase|IgnoringCase)", true),
        NotBetween: this.keywordTemplate("NotBetween", true, true),
        Between: this.keywordTemplate("Between", true, true),
        NotStartsWith: this.keywordTemplate("(NotStartsWith|NotStartingWith)", true, true),
        StartsWith: this.keywordTemplate("(StartsWith|StartingWith)", true, true),
        NotEndsWith: this.keywordTemplate("(NotEndsWith|NotEndingWith)", true, true),
        EndsWith: this.keywordTemplate("(EndsWith|EndingWith)", true, true),
        NotContains: this.keywordTemplate("(NotContains|NotContaining)", true, true),
        Contains: this.keywordTemplate("(Contains|Containing)", true, true),
        NotLike: this.keywordTemplate("NotLike", true, true),
        Like: this.keywordTemplate("Like", true, true),
        LessThanEqual: this.keywordTemplate("(LessThanEqual|Lte)", true, true),
        LessThan: this.keywordTemplate("(LessThan|Lt)", true, true),
        GreaterThanEqual: this.keywordTemplate("(GreaterThanEqual|Gte)", true, true),
        GreaterThan: this.keywordTemplate("(GreaterThan|Gt)", true, true),
        After: this.keywordTemplate("After", true, true),
        Before: this.keywordTemplate("Before", true, true),
        NotIn: this.keywordTemplate("NotIn", true, true),
        In: this.keywordTemplate("In", true, true),
        Not: this.keywordTemplate("Not", true, true),
        Is: this.keywordTemplate("Is", true),
        Equals: this.keywordTemplate("(Equals|Equal)", true, true),
        NotEquals: this.keywordTemplate("(NotEquals|NotEqual)", true, true),
        Without: this.keywordTemplate("Without", true, false, true),
        With: this.keywordTemplate("With", true, false, true),
        Some: this.keywordTemplate("Some", true, false, true),
        Every: this.keywordTemplate("Every", true, false, true),
        None: this.keywordTemplate("None", true, false, true),
    };

    private static operators = {
        And: this.keywordTemplate("And"),
        Or: this.keywordTemplate("Or"),
        AND: this.keywordTemplate("AND"),
    };

    private static customizationModifiers = {
        OrderBy: this.keywordTemplate("OrderBy"),
        PaginatedAndOrdered: /PaginatedAndOrdered$/,
        OrderedAndPaginated: /OrderedAndPaginated$/,
        Paginated: /Paginated$/,
        Ordered: /Ordered$/,
    };

    private logAndThrowError(errorMessage: string): never {
        this.logger.logError(errorMessage);

        throw new VSRepoError(errorMessage, VSRepoErrorType.RESOLVER);
    }

    private getValue<R>(args: any[], positionIndex: number): R {
        const value = args.at(positionIndex);
        if (value === DEBUG_ARG_SYMBOL) {
            return `<args>[${positionIndex < 0 ? args.length + positionIndex : positionIndex}]` as R;
        }

        return value;
    }

    private static readonly supportedMethods: {
        validate: (dm: string) => boolean;
        getOverrides: (dm: string) => Partial<DynamicMethodInfo>;
    }[] = (() => {
        const $whereMethodBoilerPlate = ({
            otherParams,
            argsCount,
        }: {
            otherParams?: string[];
            argsCount?: number;
        } = {}): Partial<DynamicMethodInfo> => ({
            ignoreWhere: true,
            onlyBaseWheres: true,
            whereIndex: 0,
            otherParams: otherParams ?? ["where"],
            argsCount: argsCount ?? 1,
        });

        return [
            {
                validate: dm => dm.startsWith("findOneBy"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("findOneBy", ""),
                    ignoreOrderByAndPagination: false,
                    method: "findOne",
                }),
            },
            {
                validate: dm => dm.startsWith("findBy"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("findBy", ""),
                    ignoreOrderByAndPagination: false,
                    method: "findMany",
                }),
            },
            {
                validate: dm => dm.startsWith("findAndCountBy"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("findAndCountBy", ""),
                    ignoreOrderByAndPagination: false,
                    findAndCountMode: true,
                }),
            },
            {
                validate: dm => dm.startsWith("findAndCountWhere"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("findAndCountWhere", ""),
                    ignoreOrderByAndPagination: false,
                    findAndCountMode: true,
                    ...$whereMethodBoilerPlate(),
                }),
            },
            {
                validate: dm => dm.startsWith("findOneOrThrowBy"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("findOneOrThrowBy", ""),
                    ignoreOrderByAndPagination: false,
                    method: "findOneOrThrow",
                }),
            },
            {
                validate: dm => dm.startsWith("findOneOrThrowWhere"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("findOneOrThrowWhere", ""),
                    ignoreOrderByAndPagination: false,
                    method: "findOneOrThrow",
                    ...$whereMethodBoilerPlate(),
                }),
            },
            {
                validate: dm => dm.startsWith("findWhere"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("findWhere", ""),
                    ignoreOrderByAndPagination: false,
                    method: "findMany",
                    ...$whereMethodBoilerPlate(),
                }),
            },
            {
                validate: dm => dm.startsWith("findOneWhere"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("findOneWhere", ""),
                    ignoreOrderByAndPagination: false,
                    method: "findOne",
                    ...$whereMethodBoilerPlate(),
                }),
            },
            {
                validate: dm => dm.startsWith("countBy"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("countBy", ""),
                    ignoreSelect: true,
                    method: "count",
                }),
            },
            {
                validate: dm => dm.startsWith("countWhere"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("countWhere", ""),
                    ignoreSelect: true,
                    method: "count",
                    ...$whereMethodBoilerPlate(),
                }),
            },
            {
                validate: dm => dm.startsWith("existsBy"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("existsBy", ""),
                    ignoreSelect: true,
                    existsMode: true,
                    method: "exists",
                }),
            },
            {
                validate: dm => dm.startsWith("existsWhere"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("existsWhere", ""),
                    ignoreSelect: true,
                    existsMode: true,
                    method: "exists",
                    ...$whereMethodBoilerPlate(),
                }),
            },
            {
                validate: dm => dm.startsWith("updateManyReturningBy"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("updateManyReturningBy", ""),
                    method: "updateManyReturning",
                    dataIndex: -2,
                    otherParams: ["data"],
                    argsCount: 1,
                }),
            },
            {
                validate: dm => dm.startsWith("updateManyReturningWhere"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("updateManyReturningWhere", ""),
                    method: "updateManyReturning",
                    dataIndex: -2,
                    ...$whereMethodBoilerPlate({ otherParams: ["where", "data"], argsCount: 2 }),
                }),
            },
            {
                validate: dm => dm.startsWith("updateManyBy"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("updateManyBy", ""),
                    ignoreSelect: true,
                    method: "updateMany",
                    dataIndex: -2,
                    otherParams: ["data"],
                    argsCount: 1,
                }),
            },
            {
                validate: dm => dm.startsWith("updateManyWhere"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("updateManyWhere", ""),
                    ignoreSelect: true,
                    method: "updateMany",
                    dataIndex: -2,
                    ...$whereMethodBoilerPlate({ otherParams: ["where", "data"], argsCount: 2 }),
                }),
            },
            {
                validate: dm => dm.startsWith("updateBy"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("updateBy", ""),
                    method: "update",
                    dataIndex: -2,
                    otherParams: ["data"],
                    argsCount: 1,
                }),
            },
            {
                validate: dm => dm.startsWith("updateWhere"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("updateWhere", ""),
                    method: "update",
                    dataIndex: -2,
                    ...$whereMethodBoilerPlate({ otherParams: ["where", "data"], argsCount: 2 }),
                }),
            },
            {
                validate: dm => dm.startsWith("upsertBy"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("upsertBy", ""),
                    method: "upsert",
                    createIndex: -3,
                    updateIndex: -2,
                    otherParams: ["create", "update"],
                    argsCount: 2,
                }),
            },
            {
                validate: dm => dm.startsWith("upsertWhere"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("upsertWhere", ""),
                    method: "upsert",
                    createIndex: -3,
                    updateIndex: -2,
                    ...$whereMethodBoilerPlate({ otherParams: ["where", "create", "update"], argsCount: 3 }),
                }),
            },
            {
                validate: dm => dm.startsWith("deleteManyReturningBy"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("deleteManyReturningBy", ""),
                    method: "deleteManyReturning",
                }),
            },
            {
                validate: dm => dm.startsWith("deleteManyReturningWhere"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("deleteManyReturningWhere", ""),
                    method: "deleteManyReturning",
                    ...$whereMethodBoilerPlate(),
                }),
            },
            {
                validate: dm => dm.startsWith("deleteManyBy"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("deleteManyBy", ""),
                    ignoreSelect: true,
                    method: "deleteMany",
                }),
            },
            {
                validate: dm => dm.startsWith("deleteManyWhere"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("deleteManyWhere", ""),
                    ignoreSelect: true,
                    method: "deleteMany",
                    ...$whereMethodBoilerPlate(),
                }),
            },
            {
                validate: dm => dm.startsWith("deleteBy"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("deleteBy", ""),
                    method: "delete",
                }),
            },
            {
                validate: dm => dm.startsWith("deleteWhere"),
                getOverrides: dm => ({
                    keyToMapReplaced: dm.replace("deleteWhere", ""),
                    method: "delete",
                    ...$whereMethodBoilerPlate(),
                }),
            },
        ];
    })();

    private resolveDynamicMethodInfo(dynamicMethod: string): DynamicMethodInfo {
        const override = DynamicMethodsResolver.supportedMethods.find(m => m.validate(dynamicMethod));

        if (!override) {
            this.logAndThrowError(`Unknown dynamic method: ${dynamicMethod}.`);
        }

        return {
            onlyBaseWheres: false,
            ignoreWhere: false,
            ignoreOrderByAndPagination: true,
            ignoreSelect: false,
            keyToMapReplaced: "",
            argsCount: 0,
            method: "unknown",
            existsMode: false,
            whereParams: [],
            otherParams: [],
            originalDynamicMethodName: dynamicMethod,
            ...override.getOverrides(dynamicMethod),
        };
    }

    private resolveDynamicMethodCustomization(
        dynamicMethodInfo: DynamicMethodInfo,
        methodData: DynamicMethodOptions<T>,
    ) {
        const dynamicMethodCustomization: DynamicMethodCustomization = {};

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

        return dynamicMethodCustomization;
    }

    private resolveUglyWhere(keySplitedAnd: string) {
        const uglyWhere: VSRepoUglyWhere = { name: "", pushProperty: "$$$" };
        let nullMode: "is" | "not" | undefined = undefined;

        if (DynamicMethodsResolver.fieldModifiers.IsNotNull.test(keySplitedAnd)) {
            uglyWhere.pushProperty = "not";
            uglyWhere.autoInjectVal = null;
            nullMode = "not";
            keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.IsNotNull, "");
        } else if (DynamicMethodsResolver.fieldModifiers.IsNull.test(keySplitedAnd)) {
            uglyWhere.pushProperty = "$$$";
            uglyWhere.autoInjectVal = null;
            nullMode = "is";
            keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.IsNull, "");
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
            } else if (DynamicMethodsResolver.fieldModifiers.NotLike.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "not.like";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.NotLike, "");
            } else if (DynamicMethodsResolver.fieldModifiers.Like.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "like";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.Like, "");
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
            } else if (DynamicMethodsResolver.fieldModifiers.NotEquals.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "not";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.NotEquals, "");
            } else if (DynamicMethodsResolver.fieldModifiers.Equals.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "$$$";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.Equals, "");
            } else if (DynamicMethodsResolver.fieldModifiers.After.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "gt";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.After, "");
            } else if (DynamicMethodsResolver.fieldModifiers.Before.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "lt";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.Before, "");
            } else if (DynamicMethodsResolver.fieldModifiers.NotIn.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "notIn";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.NotIn, "");
            } else if (DynamicMethodsResolver.fieldModifiers.In.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "in";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.In, "");
            } else if (DynamicMethodsResolver.fieldModifiers.Not.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "not";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.Not, "");
            } else if (DynamicMethodsResolver.fieldModifiers.Is.test(keySplitedAnd)) {
                uglyWhere.pushProperty = "$$$";
                keySplitedAnd = keySplitedAnd.replace(DynamicMethodsResolver.fieldModifiers.Is, "");
            } else {
                uglyWhere.pushProperty = "$$$";
            }
        }

        let relMatch: RegExpExecArray | null;

        if ((relMatch = DynamicMethodsResolver.fieldModifiers.Without.exec(keySplitedAnd))) {
            const specificField = keySplitedAnd.slice(relMatch.index + relMatch[0].length);
            if (!specificField) {
                if (nullMode) {
                    uglyWhere.pushProperty = nullMode === "not" ? "_with" : "_without";
                } else {
                    uglyWhere.pushProperty = "_without";
                    uglyWhere.autoInjectVal = {};
                }
            } else {
                uglyWhere.nestedField = specificField;
                uglyWhere.pushProperty = `_without.${uncapitalize(specificField)}${uglyWhere.pushProperty === "$$$" ? (uglyWhere.properties ? ".equals" : "") : `.${uglyWhere.pushProperty}`}`;
            }

            keySplitedAnd = keySplitedAnd.slice(0, relMatch.index);
        } else if ((relMatch = DynamicMethodsResolver.fieldModifiers.With.exec(keySplitedAnd))) {
            const specificField = keySplitedAnd.slice(relMatch.index + relMatch[0].length);
            if (!specificField) {
                if (nullMode) {
                    uglyWhere.pushProperty = nullMode === "not" ? "_without" : "_with";
                } else {
                    uglyWhere.pushProperty = "_with";
                    uglyWhere.autoInjectVal = {};
                }
            } else {
                uglyWhere.nestedField = specificField;
                uglyWhere.pushProperty = `_with.${uncapitalize(specificField)}${uglyWhere.pushProperty === "$$$" ? (uglyWhere.properties ? ".equals" : "") : `.${uglyWhere.pushProperty}`}`;
            }

            keySplitedAnd = keySplitedAnd.slice(0, relMatch.index);
        } else if ((relMatch = DynamicMethodsResolver.fieldModifiers.Some.exec(keySplitedAnd))) {
            const specificField = keySplitedAnd.slice(relMatch.index + relMatch[0].length);
            if (!specificField) {
                uglyWhere.pushProperty = "_some";
                uglyWhere.autoInjectVal = {};
            } else {
                uglyWhere.nestedField = specificField;
                uglyWhere.pushProperty = `_some.${uncapitalize(specificField)}${uglyWhere.pushProperty === "$$$" ? (uglyWhere.properties ? ".equals" : "") : `.${uglyWhere.pushProperty}`}`;
            }

            keySplitedAnd = keySplitedAnd.slice(0, relMatch.index);
        } else if ((relMatch = DynamicMethodsResolver.fieldModifiers.Every.exec(keySplitedAnd))) {
            const specificField = keySplitedAnd.slice(relMatch.index + relMatch[0].length);
            if (!specificField) {
                uglyWhere.pushProperty = "_every";
                uglyWhere.autoInjectVal = {};
            } else {
                uglyWhere.nestedField = specificField;
                uglyWhere.pushProperty = `_every.${uncapitalize(specificField)}${uglyWhere.pushProperty === "$$$" ? (uglyWhere.properties ? ".equals" : "") : `.${uglyWhere.pushProperty}`}`;
            }

            keySplitedAnd = keySplitedAnd.slice(0, relMatch.index);
        } else if ((relMatch = DynamicMethodsResolver.fieldModifiers.None.exec(keySplitedAnd))) {
            const specificField = keySplitedAnd.slice(relMatch.index + relMatch[0].length);
            if (!specificField) {
                uglyWhere.pushProperty = "_none";
                uglyWhere.autoInjectVal = {};
            } else {
                uglyWhere.nestedField = specificField;
                uglyWhere.pushProperty = `_none.${uncapitalize(specificField)}${uglyWhere.pushProperty === "$$$" ? (uglyWhere.properties ? ".equals" : "") : `.${uglyWhere.pushProperty}`}`;
            }

            keySplitedAnd = keySplitedAnd.slice(0, relMatch.index);
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

            dynamicMethodInfo.whereParams.push(argName + (arg.nestedField ?? ""));
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
        } = data;

        // console.log(this.adapter)

        const vsrepoArgs: VSRepoArgs<T> = { options: { db: options.db ?? this.adapter.getDbClient() } };

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
        const dynamicMethodsMap: Map<string | symbol, DynamicMethodOptions> | undefined = Reflect.getMetadata(
            DYNAMIC_METHODS_KEY,
            instance.constructor.prototype,
        );

        if (!dynamicMethodsMap?.size) {
            this.logger.logDebug("No dynamic methods to resolve");

            return 0;
        }

        const dynamicMethods = dynamicMethodsMap
            .entries()
            .reduce<VSRepoMethod[]>((prev, cur) => [...prev, { propertyKey: cur[0], ...cur[1] }], []);

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
                const options = methodOptions ?? {};

                const vsrepoResolveArgsData: VSRepoResolveArgsData<T, K> = {
                    instance,
                    options,
                    withoutWhere: dynamicMethodInfo.ignoreWhere && !dynamicMethodInfo.onlyBaseWheres,
                    specificSelect: undefined, // ? Avaliar quando vai precisar
                    withoutSelect: dynamicMethodInfo.ignoreSelect,
                    ordering:
                        dynamicMethodCustomization.orderPosition !== undefined
                            ? this.getValue(args, dynamicMethodCustomization.orderPosition)
                            : (options.order ?? dynamicMethodCustomization.injectOrdering ?? this.defaultOrdering),
                    pagination:
                        dynamicMethodCustomization.paginationPosition !== undefined
                            ? this.getValue(args, dynamicMethodCustomization.paginationPosition)
                            : options.pagination,
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
                };

                if (!dynamicMethodInfo.ignoreWhere) {
                    vsrepoResolveArgsData.specificWhere = this.resolveSpecificWhere(
                        args,
                        dynamicMethodWhereOps.prettyWheres,
                    );
                } else if (dynamicMethodInfo.onlyBaseWheres) {
                    vsrepoResolveArgsData.specificWhere =
                        dynamicMethodInfo.whereIndex !== undefined
                            ? this.getValue(args, dynamicMethodInfo.whereIndex)
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
                    methodOptions = optionsArg;
                } else {
                    args.push("1");
                }

                args = args.slice(0, dynamicMethodInfo.argsCount + 1);

                const vsrepoArgs = instance._vsrepocache.get(originalKey)!(args, methodOptions);

                const start = this.logger.startPerformLog(
                    `run ${String(originalKey)} (-> ${dynamicMethodInfo.method})`,
                );

                try {
                    let result: any;

                    if (dynamicMethodInfo.findAndCountMode) {
                        const records = await (this.adapter as any).findMany(vsrepoArgs.where, vsrepoArgs.options);
                        const count = await (this.adapter as any).count(vsrepoArgs.where, {
                            db: vsrepoArgs.options.db,
                        });

                        result = { result: records, count };
                    } else {
                        // * Todos os métodos do adapter seguem essa precedencia de parametros
                        const argsOrdered: any[] = [
                            vsrepoArgs.where,
                            vsrepoArgs.obj,
                            vsrepoArgs.create,
                            vsrepoArgs.update,
                            vsrepoArgs.options,
                        ].filter(arg => arg !== undefined);

                        result = await (this.adapter as any)[dynamicMethodInfo.method](...argsOrdered);
                    }

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
        const queryMethodsMap: Map<string | symbol, VSRepoQuery> | undefined = Reflect.getMetadata(
            QUERY_METHODS_KEY,
            instance.constructor.prototype,
        );

        if (!queryMethodsMap?.size) {
            this.logger.logDebug("No query methods to resolve");

            return 0;
        }

        const queryMethods = queryMethodsMap
            .entries()
            .reduce<(VSRepoQuery & { propertyKey: string | symbol })[]>(
                (prev, cur) => [...prev, { propertyKey: cur[0], ...cur[1] }],
                [],
            );

        this.logger.logDebug(`Resolving ${queryMethods.length} query method(s):`, queryMethods);

        for (const method of queryMethods) {
            const originalKey = method.propertyKey;

            const modifyingQueryMethod = method.modifying ?? false;
            const valueQueryMethod = method.value;
            const singleResult = method.singleResult ?? false;

            (instance as any)[originalKey] = async (...args: unknown[]) => {
                let db: any;
                let queryArgs: any[] | undefined;

                const dbPos = args.at(-1);
                if (dbPos instanceof DbArg) {
                    db = dbPos.getDb();
                    queryArgs = args.slice(0, -1);
                } else {
                    queryArgs = args;
                }

                db ??= this.adapter.getDbClient();

                let finalQuery = valueQueryMethod;
                let finalArgs = queryArgs;

                if (this.vsPlaceholders) {
                    const compiled = VSPlaceholdersParser.parse(valueQueryMethod, queryArgs).compile(index =>
                        this.adapter.getPlaceholder(index),
                    );
                    finalQuery = compiled.query;
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

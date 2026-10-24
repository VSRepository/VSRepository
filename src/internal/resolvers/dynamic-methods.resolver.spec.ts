import { DynamicMethod } from "../../decorators/dynamic-method.decorator.js";
import { QueryMethod } from "../../decorators/query-method.decorator.js";
import { VSRepoError } from "../../errors/VSRepoError.js";
import { DynamicMethodOptions } from "../../types/decorators/dynamic-method-options.type.js";
import { QueryMethodOptions } from "../../types/decorators/query-method-options.type.js";
import { VSRepoAdapter } from "../../VSRepoAdapter.js";
import { VSRepository } from "../../VSRepository.js";
import { VSLogLevel } from "../enums/vs-log-level.enum.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
import { DbArg } from "../utils/db-arg.util.js";
import { getSqlitePlaceholder } from "../utils/placeholder-fns.util.js";
import { VSLogger } from "../utils/vs-logger.util.js";
import { DynamicMethodsResolver } from "./dynamic-methods.resolver.js";
import { MergeWheresResolver } from "./merge-wheres.resolver.js";
import "reflect-metadata";

interface User {
    id: string;
    name: string;
    age: number;
    removedAt: Date | null;
}

describe("DynamicMethodsResolver", () => {
    let resolver: DynamicMethodsResolver<User, string>;
    let logger: VSLogger;
    let adapter: VSRepoAdapter<User>;
    let mergeWheresResolver: MergeWheresResolver<User>;

    beforeEach(() => {
        logger = {
            logDebug: vi.fn(),
            getLogLevel: vi.fn(),
            logError: vi.fn(),
            startPerformLog: vi.fn(),
            endPerformLog: vi.fn(),
        } as any;
        adapter = {
            getDbClient: vi.fn().mockReturnValue("default-db"),
            getPlaceholder: vi.fn(getSqlitePlaceholder),
            findOne: vi.fn(),
            findOneOrThrow: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
            exists: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
            updateManyReturning: vi.fn(),
            upsert: vi.fn(),
            delete: vi.fn(),
            deleteMany: vi.fn(),
            deleteManyReturning: vi.fn(),
            query: vi.fn(),
        } as any;
        mergeWheresResolver = new MergeWheresResolver();
        resolver = new DynamicMethodsResolver(logger, adapter, mergeWheresResolver);
    });

    it("should be defined", () => {
        expect(resolver).toBeDefined();
    });

    describe("resolve", () => {
        beforeEach(() => {
            vi.spyOn(mergeWheresResolver, "resolve").mockImplementation((_, val) => val ?? {});
            vi.spyOn(adapter, "findMany").mockResolvedValue([]);
            vi.spyOn(logger, "startPerformLog").mockResolvedValue(undefined);
            vi.spyOn(logger, "endPerformLog").mockResolvedValue(undefined);
        });

        type TestRepository = Record<string, (...args: any[]) => Promise<any>> & { _vsrepocache: Map<any, any> };

        function buildRepo(method: string, options?: DynamicMethodOptions<User>): TestRepository {
            class Repository {
                _vsrepocache = new Map();
            }

            DynamicMethod(options)(Repository.prototype, method);

            const repo = new Repository() as unknown as TestRepository;
            resolver.resolve(repo as unknown as VSRepository<any, any>);

            return repo;
        }

        function catchError(fn: () => unknown): any {
            try {
                fn();
            } catch (err) {
                return err;
            }

            throw new Error("Expected the function to throw");
        }

        async function catchAsyncError(fn: () => Promise<unknown>): Promise<any> {
            try {
                await fn();
            } catch (err) {
                return err;
            }

            throw new Error("Expected the function to reject");
        }

        it("should correctly map the dynamic methods", () => {
            class UserRepository {
                _vsrepocache = new Map();

                @DynamicMethod()
                declare findById: any;

                @DynamicMethod()
                declare findByName: any;
            }

            const userRepository = new UserRepository();

            const result = resolver.resolve(userRepository as any);

            expect(userRepository.findById).toBeTypeOf("function");
            expect(userRepository.findByName).toBeTypeOf("function");
            expect(result).toBe(2);
        });

        it("should throw if the property is a symbol", () => {
            const findById = Symbol("findById");

            class UserRepository {
                _vsrepocache = new Map();

                @DynamicMethod()
                [findById]: any;
            }

            const userRepository = new UserRepository();

            let thrown: any;

            try {
                resolver.resolve(userRepository as any);
            } catch (err) {
                thrown = err;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.RESOLVER);
        });

        it("should correctly resolve the dynamicMethods and call the adapter", async () => {
            class UserRepository {
                _vsrepocache = new Map();

                @DynamicMethod()
                declare findById: any;

                @DynamicMethod()
                declare findByName: any;
            }

            const userRepository = new UserRepository();

            resolver.resolve(userRepository as any);

            const mockId = "id";

            await userRepository.findById(mockId);

            expect(mergeWheresResolver.resolve).toHaveBeenCalledWith(undefined, { id: mockId });
            expect(adapter.findMany).toHaveBeenCalledWith({ id: mockId }, expect.anything());
            expect(logger.startPerformLog).toHaveBeenCalled();
            expect(logger.endPerformLog).toHaveBeenCalled();

            const mockName = "some name";

            await userRepository.findByName(mockName);

            expect(mergeWheresResolver.resolve).toHaveBeenCalledWith(undefined, { name: mockName });
            expect(adapter.findMany).toHaveBeenCalledWith({ name: mockName }, expect.anything());
            expect(logger.startPerformLog).toHaveBeenCalled();
            expect(logger.endPerformLog).toHaveBeenCalled();
        });

        it("should return 0 when the repository has no dynamic methods", () => {
            class UserRepository {
                _vsrepocache = new Map();
            }

            expect(resolver.resolve(new UserRepository() as any)).toBe(0);
        });

        it("should resolve the dynamic methods inherited from a parent repository", () => {
            class BaseRepository {
                _vsrepocache = new Map();

                @DynamicMethod()
                declare findByName: any;
            }

            class UserRepository extends BaseRepository {
                @DynamicMethod()
                declare findByAge: any;
            }

            const repo = new UserRepository();

            expect(resolver.resolve(repo as any)).toBe(2);
            expect(repo.findByName).toBeTypeOf("function");
            expect(repo.findByAge).toBeTypeOf("function");
        });

        it("should store the resolver of each method in the repository cache", () => {
            const repo = buildRepo("findByName");

            expect(repo._vsrepocache.has("findByName")).toBe(true);
        });

        describe("method resolution", () => {
            it("should resolve a method through proxyTo", async () => {
                const repo = buildRepo("searchUsers", { proxyTo: "findByNameAndAge" });

                await repo.searchUsers!("Ana", 20);

                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana", age: 20 }, { db: "default-db" });
            });

            it("should throw a RESOLVER error for an unknown method prefix", () => {
                const error = catchError(() => buildRepo("fetchByName"));

                expect(error).toBeInstanceOf(VSRepoError);
                expect(error.type).toBe(VSRepoErrorType.RESOLVER);
                expect(error.message).toContain("Unknown dynamic method: fetchByName.");
                expect(logger.logError).toHaveBeenCalledWith("Unknown dynamic method: fetchByName.");
            });

            it("should throw a RESOLVER error when proxyTo points to an unknown method", () => {
                const error = catchError(() => buildRepo("searchUsers", { proxyTo: "searchByName" }));

                expect(error).toBeInstanceOf(VSRepoError);
                expect(error.type).toBe(VSRepoErrorType.RESOLVER);
            });

            it('should throw a RESOLVER error when "Or" appears after an "AND"', () => {
                const error = catchError(() => buildRepo("findByNameANDAgeOrId"));

                expect(error).toBeInstanceOf(VSRepoError);
                expect(error.type).toBe(VSRepoErrorType.RESOLVER);
                expect(error.message).toContain('The logical operator "Or" cannot appear after an "AND"');
            });

            it.each([
                ["findOneByName", "findOne"],
                ["findOneOrThrowByName", "findOneOrThrow"],
                ["findByName", "findMany"],
                ["countByName", "count"],
                ["existsByName", "exists"],
                ["deleteByName", "delete"],
                ["deleteManyByName", "deleteMany"],
                ["deleteManyReturningByName", "deleteManyReturning"],
            ])("should map %s to adapter.%s", async (method, adapterMethod) => {
                const repo = buildRepo(method);

                await repo[method]!("Ana");

                expect((adapter as any)[adapterMethod]).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db" });
            });

            it.each([
                ["updateByName", "update"],
                ["updateManyByName", "updateMany"],
                ["updateManyReturningByName", "updateManyReturning"],
            ])("should map %s to adapter.%s passing the data payload", async (method, adapterMethod) => {
                const repo = buildRepo(method);

                await repo[method]!("Ana", { age: 30 });

                expect((adapter as any)[adapterMethod]).toHaveBeenCalledWith(
                    { name: "Ana" },
                    { age: 30 },
                    { db: "default-db" },
                );
            });

            it("should map upsertByName passing the create and update payloads", async () => {
                const repo = buildRepo("upsertByName");

                await repo.upsertByName!("Ana", { name: "Ana", age: 20 }, { age: 21 });

                expect(adapter.upsert).toHaveBeenCalledWith(
                    { name: "Ana" },
                    { name: "Ana", age: 20 },
                    { age: 21 },
                    { db: "default-db" },
                );
            });

            it.each([
                ["findOneWhere", "findOne"],
                ["findOneOrThrowWhere", "findOneOrThrow"],
                ["findWhere", "findMany"],
                ["countWhere", "count"],
                ["existsWhere", "exists"],
                ["deleteWhere", "delete"],
                ["deleteManyWhere", "deleteMany"],
                ["deleteManyReturningWhere", "deleteManyReturning"],
            ])("should map %s to adapter.%s using the provided where", async (method, adapterMethod) => {
                const repo = buildRepo(method);

                await repo[method]!({ name: { contains: "A" } });

                expect((adapter as any)[adapterMethod]).toHaveBeenCalledWith(
                    { name: { contains: "A" } },
                    { db: "default-db" },
                );
            });

            it.each([
                ["updateWhere", "update"],
                ["updateManyWhere", "updateMany"],
                ["updateManyReturningWhere", "updateManyReturning"],
            ])("should map %s to adapter.%s using the provided where and data", async (method, adapterMethod) => {
                const repo = buildRepo(method);

                await repo[method]!({ age: { gt: 18 } }, { name: "Adult" });

                expect((adapter as any)[adapterMethod]).toHaveBeenCalledWith(
                    { age: { gt: 18 } },
                    { name: "Adult" },
                    { db: "default-db" },
                );
            });

            it("should map upsertWhere using the provided where, create and update", async () => {
                const repo = buildRepo("upsertWhere");

                await repo.upsertWhere!({ id: "1" }, { id: "1", name: "Ana" }, { name: "Ana" });

                expect(adapter.upsert).toHaveBeenCalledWith(
                    { id: "1" },
                    { id: "1", name: "Ana" },
                    { name: "Ana" },
                    { db: "default-db" },
                );
            });

            it.each([
                ["findOne", "findOne"],
                ["findOneOrThrow", "findOneOrThrow"],
                ["count", "count"],
            ])("should map %s (no where) to adapter.%s with an empty where", async (method, adapterMethod) => {
                const repo = buildRepo(method);

                await repo[method]!();

                expect((adapter as any)[adapterMethod]).toHaveBeenCalledWith({}, { db: "default-db" });
            });

            it("should return whatever the adapter returns", async () => {
                const users = [{ id: "1", name: "Ana", age: 20, removedAt: null }];
                vi.mocked(adapter.findMany).mockResolvedValue(users);
                const repo = buildRepo("findByName");

                await expect(repo.findByName!("Ana")).resolves.toBe(users);
            });
        });

        describe("where resolution", () => {
            it.each<[string, any[], object]>([
                // * Conectores
                ["findByNameAndAge", ["Ana", 20], { name: "Ana", age: 20 }],
                ["findByNameOrAge", ["Ana", 20], { OR: [{ name: "Ana" }, { age: 20 }] }],
                ["findByNameAndAgeOrId", ["Ana", 20, "1"], { OR: [{ name: "Ana", age: 20 }, { id: "1" }] }],
                ["findByNameANDAge", ["Ana", 20], { name: "Ana", AND: [{ age: 20 }] }],
                ["findByNameAndAgeANDId", ["Ana", 20, "1"], { name: "Ana", age: 20, AND: [{ id: "1" }] }],
                ["findByNameOrAgeANDId", ["Ana", 20, "1"], { OR: [{ name: "Ana" }, { age: 20 }], AND: [{ id: "1" }] }],
                // * Igualdade
                ["findByNameIs", ["Ana"], { name: "Ana" }],
                ["findByNameEquals", ["Ana"], { name: "Ana" }],
                ["findByNameEqual", ["Ana"], { name: "Ana" }],
                ["findByNameNot", ["Ana"], { name: { not: "Ana" } }],
                ["findByNameNotEquals", ["Ana"], { name: { not: "Ana" } }],
                ["findByNameNotEqual", ["Ana"], { name: { not: "Ana" } }],
                // * Nulos e booleanos (não consomem argumentos)
                ["findByNameIsNull", [], { name: null }],
                ["findByActiveIsTrue", [], { active: true }],
                ["findByActiveIsFalse", [], { active: false }],
                // * Strings
                ["findByNameContains", ["na"], { name: { contains: "na" } }],
                ["findByNameContaining", ["na"], { name: { contains: "na" } }],
                ["findByNameNotContains", ["na"], { name: { not: { contains: "na" } } }],
                ["findByNameStartsWith", ["An"], { name: { startsWith: "An" } }],
                ["findByNameStartingWith", ["An"], { name: { startsWith: "An" } }],
                ["findByNameNotStartsWith", ["An"], { name: { not: { startsWith: "An" } } }],
                ["findByNameEndsWith", ["na"], { name: { endsWith: "na" } }],
                ["findByNameEndingWith", ["na"], { name: { endsWith: "na" } }],
                ["findByNameNotEndsWith", ["na"], { name: { not: { endsWith: "na" } } }],
                // * Ignore case
                ["findByNameIgnoreCase", ["ana"], { name: { equals: "ana", ignoreCase: true } }],
                ["findByNameIgnoringCase", ["ana"], { name: { equals: "ana", ignoreCase: true } }],
                ["findByNameStartsWithIgnoreCase", ["an"], { name: { startsWith: "an", ignoreCase: true } }],
                ["findByNameContainsIgnoreCase", ["an"], { name: { contains: "an", ignoreCase: true } }],
                // * Comparações
                ["findByAgeLessThan", [18], { age: { lt: 18 } }],
                ["findByAgeLt", [18], { age: { lt: 18 } }],
                ["findByAgeLte", [18], { age: { lte: 18 } }],
                ["findByAgeGreaterThan", [18], { age: { gt: 18 } }],
                ["findByAgeGt", [18], { age: { gt: 18 } }],
                ["findByAgeGte", [18], { age: { gte: 18 } }],
                ["findByCreatedAtAfter", [new Date(0)], { createdAt: { gt: new Date(0) } }],
                ["findByCreatedAtBefore", [new Date(0)], { createdAt: { lt: new Date(0) } }],
                // * Between / In
                ["findByAgeBetween", [[18, 30]], { age: { between: [18, 30] } }],
                ["findByAgeNotBetween", [[18, 30]], { age: { not: { between: [18, 30] } } }],
                ["findByIdIn", [["1", "2"]], { id: { in: ["1", "2"] } }],
                ["findByIdNotIn", [["1", "2"]], { id: { notIn: ["1", "2"] } }],
            ])("%s", async (method, args, expectedWhere) => {
                const repo = buildRepo(method);

                await repo[method]!(...args);

                expect(adapter.findMany).toHaveBeenCalledWith(expectedWhere, { db: "default-db" });
            });

            it("findByNameIsNotNull (should map to { name: { not: null } })", async () => {
                const repo = buildRepo("findByNameIsNotNull");

                await repo.findByNameIsNotNull!();

                expect(adapter.findMany).toHaveBeenCalledWith({ name: { not: null } }, { db: "default-db" });
            });

            it("findByAgeLessThanEqual (should map to { age: { lte } })", async () => {
                const repo = buildRepo("findByAgeLessThanEqual");

                await repo.findByAgeLessThanEqual!(18);

                expect(adapter.findMany).toHaveBeenCalledWith({ age: { lte: 18 } }, { db: "default-db" });
            });

            it("findByAgeGreaterThanEqual (should map to { age: { gte } })", async () => {
                const repo = buildRepo("findByAgeGreaterThanEqual");

                await repo.findByAgeGreaterThanEqual!(18);

                expect(adapter.findMany).toHaveBeenCalledWith({ age: { gte: 18 } }, { db: "default-db" });
            });

            describe("relations", () => {
                it.each<[string, any[], object]>([
                    ["findByPostsSome", [], { posts: { _some: {} } }],
                    ["findByPostsEvery", [], { posts: { _every: {} } }],
                    ["findByPostsNone", [], { posts: { _none: {} } }],
                    ["findByPostsWith", [], { posts: { _with: {} } }],
                    ["findByPostsWithout", [], { posts: { _without: {} } }],
                    ["findByPostsSomeTitle", ["Hi"], { posts: { _some: { title: "Hi" } } }],
                    ["findByPostsEveryTitle", ["Hi"], { posts: { _every: { title: "Hi" } } }],
                    ["findByPostsNoneTitle", ["Hi"], { posts: { _none: { title: "Hi" } } }],
                    ["findByPostsEveryTitleContains", ["Hi"], { posts: { _every: { title: { contains: "Hi" } } } }],
                    ["findByProfileWithBio", ["x"], { profile: { _with: { bio: "x" } } }],
                    ["findByProfileWithoutBio", ["x"], { profile: { _without: { bio: "x" } } }],
                    ["findByProfileIsNull", [], { profile: null }],
                ])("%s", async (method, args, expectedWhere) => {
                    const repo = buildRepo(method);

                    await repo[method]!(...args);

                    expect(adapter.findMany).toHaveBeenCalledWith(expectedWhere, { db: "default-db" });
                });
            });
        });

        describe("method options", () => {
            it("should use the adapter db client by default", async () => {
                const repo = buildRepo("findByName");

                await repo.findByName!("Ana");

                expect(adapter.getDbClient).toHaveBeenCalled();
                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db" });
            });

            it("should use the db provided in the options", async () => {
                const repo = buildRepo("findByName");

                await repo.findByName!("Ana", { db: "tx" });

                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "tx" });
            });

            it("should forward the see mode to the mergeWheresResolver", async () => {
                const repo = buildRepo("findByName");

                await repo.findByName!("Ana", { see: "all" });

                expect(mergeWheresResolver.resolve).toHaveBeenCalledWith("all", { name: "Ana" });
            });

            it("should forward select and relations to the adapter", async () => {
                const repo = buildRepo("findByName");
                const select = { id: true, name: true };
                const relations = { posts: true };

                await repo.findByName!("Ana", { select, relations });

                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db", select, relations });
            });

            it.each(["countByName", "existsByName", "deleteManyByName", "updateManyByName"])(
                "should ignore select and relations on %s",
                async method => {
                    const repo = buildRepo(method);
                    const options = { select: { id: true }, relations: { posts: true } };

                    if (method === "updateManyByName") {
                        await repo[method]!("Ana", { age: 1 }, options);
                    } else {
                        await repo[method]!("Ana", options);
                    }

                    const adapterMethod = method.replace(/ByName$/, "").replace(/^(.)/, c => c.toLowerCase());
                    const call = vi.mocked((adapter as any)[adapterMethod]).mock.calls[0]!;

                    expect(call.at(-1)).toEqual({ db: "default-db" });
                },
            );

            it.each(["deleteByName", "deleteManyReturningByName", "updateManyReturningByName"])(
                "should keep select and relations on %s",
                async method => {
                    const repo = buildRepo(method);
                    const select = { id: true };
                    const relations = { posts: true };

                    if (method === "updateManyReturningByName") {
                        await repo[method]!("Ana", { age: 1 }, { select, relations });
                    } else {
                        await repo[method]!("Ana", { select, relations });
                    }

                    const adapterMethod = method.replace(/ByName$/, "");
                    const call = vi.mocked((adapter as any)[adapterMethod]).mock.calls[0]!;

                    expect(call.at(-1)).toEqual({ db: "default-db", select, relations });
                },
            );

            it("should treat an explicit undefined options argument as no options", async () => {
                const repo = buildRepo("findByName");

                await repo.findByName!("Ana", undefined);

                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db" });
            });

            it("should ignore extra arguments after the options", async () => {
                const repo = buildRepo("findByName");

                await repo.findByName!("Ana", { db: "tx" }, "extra");

                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "tx" });
            });

            it("should not mutate the options provided by the caller", async () => {
                const repo = buildRepo("findByName");
                const options = Object.freeze({ db: "tx", see: "all" as const });

                await expect(repo.findByName!("Ana", options)).resolves.not.toThrow();
            });

            it("should merge the where with the soft delete field when using a real MergeWheresResolver", async () => {
                resolver = new DynamicMethodsResolver(logger, adapter, new MergeWheresResolver("removedAt"));
                const repo = buildRepo("findByName");

                await repo.findByName!("Ana");
                expect(adapter.findMany).toHaveBeenLastCalledWith(
                    { name: "Ana", removedAt: null },
                    { db: "default-db" },
                );

                await repo.findByName!("Ana", { see: "removed" });
                expect(adapter.findMany).toHaveBeenLastCalledWith(
                    { name: "Ana", removedAt: { not: null } },
                    { db: "default-db" },
                );

                await repo.findByName!("Ana", { see: "all" });
                expect(adapter.findMany).toHaveBeenLastCalledWith({ name: "Ana" }, { db: "default-db" });
            });
        });

        describe("missing parameters", () => {
            it.each<[string, any[], string]>([
                ["findByNameAndAge", [], "name, age"],
                ["findByNameAndAge", ["Ana"], "age"],
                ["findByNamePaginated", ["Ana"], "pagination"],
                ["findByNameOrdered", ["Ana"], "order"],
                ["findByNamePaginatedAndOrdered", ["Ana"], "pagination, order"],
                ["findByNameOrderedAndPaginated", ["Ana"], "order, pagination"],
                ["updateById", ["1"], "data"],
                ["updateWhere", [], "where, data"],
                ["upsertById", ["1", {}], "update"],
                ["upsertWhere", [], "where, create, update"],
                ["findWhere", [], "where"],
                ["deleteById", [], "id"],
            ])("%s(%j) should report: %s", async (method, args, missing) => {
                const repo = buildRepo(method);

                const error = await catchAsyncError(() => repo[method]!(...args));

                expect(error).toBeInstanceOf(VSRepoError);
                expect(error.type).toBe(VSRepoErrorType.DYNAMIC);
                expect(error.message).toContain(`Missing parameters: ${missing}`);
                expect(logger.logError).toHaveBeenCalledWith(`Cannot run '${method}': Missing parameters: ${missing}`);
            });

            it("should not call the adapter when parameters are missing", async () => {
                const repo = buildRepo("findByNameAndAge");

                await catchAsyncError(() => repo.findByNameAndAge!("Ana"));

                expect(adapter.findMany).not.toHaveBeenCalled();
            });

            it("should not require arguments for the modifiers that inject their own value", async () => {
                const repo = buildRepo("findByNameIsNullAndActiveIsTrue");

                await repo.findByNameIsNullAndActiveIsTrue!();

                expect(adapter.findMany).toHaveBeenCalledWith({ name: null, active: true }, { db: "default-db" });
            });
        });

        describe("ordering and pagination", () => {
            const defaultOrdering = [{ name: "ASC" }] as any;

            it("should not send order or pagination when none is defined", async () => {
                const repo = buildRepo("findByName");

                await repo.findByName!("Ana");

                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db" });
            });

            it("should use the pagination provided in the options", async () => {
                const repo = buildRepo("findByName");
                const pagination = { page: 1, size: 10 };

                await repo.findByName!("Ana", { pagination });

                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db", pagination });
            });

            it("should use the order provided in the options", async () => {
                const repo = buildRepo("findByName");
                const order = [{ age: "DESC" }];

                await repo.findByName!("Ana", { order });

                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db", order });
            });

            it.each([
                ["findByNameOrderByAge", [{ age: "ASC" }]],
                ["findByNameOrderByAgeAsc", [{ age: "ASC" }]],
                ["findByNameOrderByAgeDesc", [{ age: "DESC" }]],
                ["findByNameOrderByAgeAscAndNameDesc", [{ age: "ASC" }, { name: "DESC" }]],
                ["findByNameOrderByAgeDescAndIdAsc", [{ age: "DESC" }, { id: "ASC" }]],
            ])("%s should inject the ordering from the method name", async (method, expectedOrder) => {
                const repo = buildRepo(method);

                await repo[method]!("Ana");

                expect(adapter.findMany).toHaveBeenCalledWith(
                    { name: "Ana" },
                    { db: "default-db", order: expectedOrder },
                );
            });

            it("should read the order and the pagination from the arguments on PaginatedAndOrdered", async () => {
                const repo = buildRepo("findByNamePaginatedAndOrdered");
                const pagination = { page: 2, size: 5 };
                const order = [{ age: "DESC" }];

                await repo.findByNamePaginatedAndOrdered!("Ana", pagination, order);

                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db", order, pagination });
            });

            it("should read the order and the pagination from the arguments on OrderedAndPaginated", async () => {
                const repo = buildRepo("findByNameOrderedAndPaginated");
                const pagination = { page: 2, size: 5 };
                const order = [{ age: "DESC" }];

                await repo.findByNameOrderedAndPaginated!("Ana", order, pagination);

                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db", order, pagination });
            });

            it("should read only the pagination from the arguments on Paginated", async () => {
                const repo = buildRepo("findByNamePaginated");
                const pagination = { page: 3, size: 20 };

                await repo.findByNamePaginated!("Ana", pagination);

                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db", pagination });
            });

            it("should read only the order from the arguments on Ordered", async () => {
                const repo = buildRepo("findByNameOrdered");
                const order = [{ age: "DESC" }];

                await repo.findByNameOrdered!("Ana", order);

                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db", order });
            });

            it("should still accept the method options after the positional order and pagination", async () => {
                const repo = buildRepo("findByNamePaginatedAndOrdered");
                const pagination = { page: 1, size: 1 };
                const order = [{ age: "ASC" }];

                await repo.findByNamePaginatedAndOrdered!("Ana", pagination, order, { db: "tx", see: "all" });

                expect(mergeWheresResolver.resolve).toHaveBeenCalledWith("all", { name: "Ana" });
                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "tx", order, pagination });
            });

            it("should prefer the positional order over the one in the options", async () => {
                const repo = buildRepo("findByNameOrdered");
                const order = [{ age: "DESC" }];

                await repo.findByNameOrdered!("Ana", order, { order: [{ id: "ASC" }] });

                expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db", order });
            });

            it("should support ordering by name together with a positional pagination suffix", async () => {
                const repo = buildRepo("findByNameOrderByAgeDescPaginated");
                const pagination = { page: 1, size: 3 };

                await repo.findByNameOrderByAgeDescPaginated!("Ana", pagination);

                expect(adapter.findMany).toHaveBeenCalledWith(
                    { name: "Ana" },
                    { db: "default-db", order: [{ age: "DESC" }], pagination },
                );
            });

            describe("ordering precedence", () => {
                it("should use the repository default ordering", async () => {
                    resolver = new DynamicMethodsResolver(logger, adapter, mergeWheresResolver, defaultOrdering);
                    const repo = buildRepo("findByName");

                    await repo.findByName!("Ana");

                    expect(adapter.findMany).toHaveBeenCalledWith(
                        { name: "Ana" },
                        { db: "default-db", order: defaultOrdering },
                    );
                });

                it("should prefer the injectOrdering of the decorator over the default ordering", async () => {
                    resolver = new DynamicMethodsResolver(logger, adapter, mergeWheresResolver, defaultOrdering);
                    const injectOrdering = [{ age: "DESC" }] as any;
                    const repo = buildRepo("findByName", { injectOrdering });

                    await repo.findByName!("Ana");

                    expect(adapter.findMany).toHaveBeenCalledWith(
                        { name: "Ana" },
                        { db: "default-db", order: injectOrdering },
                    );
                });

                it("should prefer the OrderBy of the method name over the decorator injectOrdering", async () => {
                    const repo = buildRepo("findByNameOrderByIdDesc", { injectOrdering: [{ age: "ASC" }] as any });

                    await repo.findByNameOrderByIdDesc!("Ana");

                    expect(adapter.findMany).toHaveBeenCalledWith(
                        { name: "Ana" },
                        { db: "default-db", order: [{ id: "DESC" }] },
                    );
                });

                it("should prefer the order in the options over every injected ordering", async () => {
                    resolver = new DynamicMethodsResolver(logger, adapter, mergeWheresResolver, defaultOrdering);
                    const repo = buildRepo("findByName", { injectOrdering: [{ age: "DESC" }] as any });
                    const order = [{ id: "ASC" }];

                    await repo.findByName!("Ana", { order });

                    expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db", order });
                });

                it("should not apply the default ordering to methods without ordering support", async () => {
                    resolver = new DynamicMethodsResolver(logger, adapter, mergeWheresResolver, defaultOrdering);
                    const repo = buildRepo("countByName");

                    await repo.countByName!("Ana");

                    expect(adapter.count).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db" });
                });
            });

            describe("supported prefixes", () => {
                it.each([
                    ["findOneByNameOrderByAgeDesc", "findOne"],
                    ["findOneOrThrowByNameOrderByAgeDesc", "findOneOrThrow"],
                    ["findByNameOrderByAgeDesc", "findMany"],
                ])("%s should apply the ordering", async (method, adapterMethod) => {
                    const repo = buildRepo(method);

                    await repo[method]!("Ana");

                    expect((adapter as any)[adapterMethod]).toHaveBeenCalledWith(
                        { name: "Ana" },
                        { db: "default-db", order: [{ age: "DESC" }] },
                    );
                });

                it("should apply the ordering on the Where variants", async () => {
                    const repo = buildRepo("findWhereOrdered");
                    const order = [{ age: "DESC" }];

                    await repo.findWhereOrdered!({ name: "Ana" }, order);

                    expect(adapter.findMany).toHaveBeenCalledWith({ name: "Ana" }, { db: "default-db", order });
                });
            });

            describe("unsupported prefixes", () => {
                it.each([
                    "countByNameOrdered",
                    "countByNamePaginated",
                    "countByNameOrderByAge",
                    "existsByNameOrdered",
                    "deleteByNamePaginated",
                    "deleteManyByNameOrderByAge",
                    "updateByIdOrdered",
                    "upsertByIdPaginated",
                ])("%s should throw a RESOLVER error", method => {
                    const error = catchError(() => buildRepo(method));

                    expect(error).toBeInstanceOf(VSRepoError);
                    expect(error.type).toBe(VSRepoErrorType.RESOLVER);
                    expect(error.message).toContain(
                        `This dynamic method prefix doesn't support the ordering or pagination modifiers: ${method}.`,
                    );
                    expect(logger.logError).toHaveBeenCalled();
                });
            });
        });

        describe("perform logs", () => {
            it("should log the start and the end of the execution", async () => {
                const start = { operation: "op", start: 0 };
                vi.mocked(logger.startPerformLog).mockReturnValue(start);
                const repo = buildRepo("findByName");

                await repo.findByName!("Ana");

                expect(logger.startPerformLog).toHaveBeenCalledWith("run findByName (-> findMany)");
                expect(logger.endPerformLog).toHaveBeenCalledWith(start);
            });

            it("should use the proxied method in the log of the original key", async () => {
                const repo = buildRepo("searchUsers", { proxyTo: "countByName" });

                await repo.searchUsers!("Ana");

                expect(logger.startPerformLog).toHaveBeenCalledWith("run searchUsers (-> count)");
            });

            it("should end the perform log and rethrow when the adapter fails", async () => {
                const start = { operation: "op", start: 0 };
                const failure = new Error("db down");
                vi.mocked(logger.startPerformLog).mockReturnValue(start);
                vi.mocked(adapter.findMany).mockRejectedValue(failure);
                const repo = buildRepo("findByName");

                await expect(repo.findByName!("Ana")).rejects.toBe(failure);

                expect(logger.endPerformLog).toHaveBeenCalledTimes(1);
                expect(logger.endPerformLog).toHaveBeenCalledWith(start);
            });

            it("should not start the perform log when the parameters are missing", async () => {
                const repo = buildRepo("findByNameAndAge");

                await catchAsyncError(() => repo.findByNameAndAge!("Ana"));

                expect(logger.startPerformLog).not.toHaveBeenCalled();
            });
        });

        describe("debug mode", () => {
            beforeEach(() => {
                vi.mocked(logger.getLogLevel).mockReturnValue(VSLogLevel.DEBUG);
            });

            it("should log how many methods are being resolved", () => {
                buildRepo("findByName");

                expect(logger.logDebug).toHaveBeenCalledWith("Resolving 1 dynamic method(s):", [
                    expect.objectContaining({ propertyKey: "findByName" }),
                ]);
            });

            it("should log a preview of the args with positional placeholders", () => {
                buildRepo("findByNameAndAge");

                expect(logger.logDebug).toHaveBeenCalledWith("Args preview for findByNameAndAge:", {
                    where: { name: "<args>[0]", age: "<args>[1]" },
                    options: {},
                });
            });

            it("should log the placeholders of the positional pagination and order", () => {
                buildRepo("findByNamePaginatedAndOrdered");

                expect(logger.logDebug).toHaveBeenCalledWith("Args preview for findByNamePaginatedAndOrdered:", {
                    where: { name: "<args>[0]" },
                    options: { pagination: "<args>[1]", order: "<args>[2]" },
                });
            });

            it("should log the placeholder of a Where variant", () => {
                buildRepo("findWhere");

                expect(logger.logDebug).toHaveBeenCalledWith("Args preview for findWhere:", {
                    where: "<args>[0]",
                    options: {},
                });
            });

            it("should not include the db in the preview", () => {
                buildRepo("findByName");

                const preview = vi
                    .mocked(logger.logDebug)
                    .mock.calls.find(([text]) => text.startsWith("Args preview"))!;

                expect(preview[1].options).not.toHaveProperty("db");
            });

            it("should not call the adapter while generating the preview", () => {
                buildRepo("findByName");

                expect(adapter.findMany).not.toHaveBeenCalled();
            });
        });

        describe("when not in debug mode", () => {
            it("should not log the args preview", () => {
                buildRepo("findByName");

                const texts = vi.mocked(logger.logDebug).mock.calls.map(([text]) => text);

                expect(texts).toEqual(["Resolving 1 dynamic method(s):"]);
            });
        });
    });

    describe("resolveQueries", () => {
        function buildQueryRepo(method: string, sql: string, options?: QueryMethodOptions, customResolver = resolver) {
            class Repository {
                _vsrepocache = new Map();
            }

            QueryMethod(sql, options)(Repository.prototype, method);

            const repo = new Repository() as any;
            const count = customResolver.resolveQueries(repo);

            return { repo: repo as Record<string, (...args: any[]) => Promise<any>>, count };
        }

        beforeEach(() => {
            vi.mocked(adapter.query).mockResolvedValue([] as any);
        });

        it("should return the number of resolved query methods", () => {
            class UserRepository {
                _vsrepocache = new Map();

                @QueryMethod("select * from user")
                declare findAll: any;

                @QueryMethod("delete from user", { modifying: true })
                declare removeAll: any;
            }

            const repo = new UserRepository();

            expect(resolver.resolveQueries(repo as any)).toBe(2);
            expect(repo.findAll).toBeTypeOf("function");
            expect(repo.removeAll).toBeTypeOf("function");
        });

        it("should return 0 when the repository has no query methods", () => {
            class UserRepository {
                _vsrepocache = new Map();
            }

            expect(resolver.resolveQueries(new UserRepository() as any)).toBe(0);
        });

        it("should log how many query methods are being resolved", () => {
            buildQueryRepo("findAll", "select * from user");

            expect(logger.logDebug).toHaveBeenCalledWith("Resolving 1 query method(s):", [
                expect.objectContaining({ propertyKey: "findAll", value: "select * from user" }),
            ]);
        });

        it("should resolve the query methods inherited from a parent repository", () => {
            class BaseRepository {
                _vsrepocache = new Map();

                @QueryMethod("select 1")
                declare ping: any;
            }

            class UserRepository extends BaseRepository {
                @QueryMethod("select * from user")
                declare findAll: any;
            }

            const repo = new UserRepository();

            expect(resolver.resolveQueries(repo as any)).toBe(2);
            expect(repo.ping).toBeTypeOf("function");
        });

        it("should compile the vs placeholders using the adapter placeholder", async () => {
            const { repo } = buildQueryRepo("findByName", "select * from user where name = ?1 and age > ?2");

            await repo.findByName!("Ana", 18);

            expect(adapter.getPlaceholder).toHaveBeenCalled();
            expect(adapter.query).toHaveBeenCalledWith("select * from user where name = ? and age > ?", {
                db: "default-db",
                args: ["Ana", 18],
                modifying: false,
            });
        });

        it("should use the placeholder format of the adapter", async () => {
            vi.mocked(adapter.getPlaceholder).mockImplementation(index => `$${index + 1}`);
            const { repo } = buildQueryRepo("findByName", "select * from user where name = ?1 and age > ?2");

            await repo.findByName!("Ana", 18);

            expect(adapter.query).toHaveBeenCalledWith("select * from user where name = $1 and age > $2", {
                db: "default-db",
                args: ["Ana", 18],
                modifying: false,
            });
        });

        it("should send the query as-is when vsPlaceholders is disabled", async () => {
            resolver = new DynamicMethodsResolver(logger, adapter, mergeWheresResolver, undefined, false);
            const { repo } = buildQueryRepo("findByName", "select * from user where name = $1");

            await repo.findByName!("Ana");

            expect(adapter.getPlaceholder).not.toHaveBeenCalled();
            expect(adapter.query).toHaveBeenCalledWith("select * from user where name = $1", {
                db: "default-db",
                args: ["Ana"],
                modifying: false,
            });
        });

        it("should use the db wrapped in a DbArg and not send it as a query arg", async () => {
            const { repo } = buildQueryRepo("findByName", "select * from user where name = ?1");

            await repo.findByName!("Ana", new DbArg("tx" as any));

            expect(adapter.getDbClient).not.toHaveBeenCalled();
            expect(adapter.query).toHaveBeenCalledWith("select * from user where name = ?", {
                db: "tx",
                args: ["Ana"],
                modifying: false,
            });
        });

        it("should pass the modifying flag to the adapter", async () => {
            const { repo } = buildQueryRepo("deactivate", "update user set active = false where id = ?1", {
                modifying: true,
            });

            await repo.deactivate!("1");

            expect(adapter.query).toHaveBeenCalledWith("update user set active = false where id = ?", {
                db: "default-db",
                args: ["1"],
                modifying: true,
            });
        });

        it("should return the adapter result as-is by default", async () => {
            const rows = [{ id: "1" }, { id: "2" }];
            vi.mocked(adapter.query).mockResolvedValue(rows as any);
            const { repo } = buildQueryRepo("findAll", "select * from user");

            await expect(repo.findAll!()).resolves.toBe(rows);
        });

        it("should collapse the result to the first row on singleResult", async () => {
            vi.mocked(adapter.query).mockResolvedValue([{ id: "1" }, { id: "2" }] as any);
            const { repo } = buildQueryRepo("findFirst", "select * from user", { singleResult: true });

            await expect(repo.findFirst!()).resolves.toEqual({ id: "1" });
        });

        it("should resolve to null on singleResult when there are no rows", async () => {
            vi.mocked(adapter.query).mockResolvedValue([] as any);
            const { repo } = buildQueryRepo("findFirst", "select * from user", { singleResult: true });

            await expect(repo.findFirst!()).resolves.toBeNull();
        });

        it("should not collapse a non-array result on singleResult", async () => {
            vi.mocked(adapter.query).mockResolvedValue(3 as any);
            const { repo } = buildQueryRepo("deactivate", "update user set active = false", {
                modifying: true,
                singleResult: true,
            });

            await expect(repo.deactivate!()).resolves.toBe(3);
        });

        it("should log the resolved query in debug", async () => {
            const { repo } = buildQueryRepo("findByName", "select * from user where name = ?1", {
                singleResult: true,
            });

            await repo.findByName!("Ana");

            expect(logger.logDebug).toHaveBeenCalledWith("QueryMethod 'findByName':", {
                query: "select * from user where name = ?",
                args: ["Ana"],
                modifying: false,
                singleResult: true,
            });
        });

        it("should log the start and the end of the execution", async () => {
            const start = { operation: "op", start: 0 };
            vi.mocked(logger.startPerformLog).mockReturnValue(start);
            const { repo } = buildQueryRepo("findAll", "select * from user");

            await repo.findAll!();

            expect(logger.startPerformLog).toHaveBeenCalledWith("run findAll (Modifying: false)");
            expect(logger.endPerformLog).toHaveBeenCalledWith(start);
        });

        it("should end the perform log and rethrow when the query fails", async () => {
            const start = { operation: "op", start: 0 };
            const failure = new Error("syntax error");
            vi.mocked(logger.startPerformLog).mockReturnValue(start);
            vi.mocked(adapter.query).mockRejectedValue(failure);
            const { repo } = buildQueryRepo("findAll", "select * from user");

            await expect(repo.findAll!()).rejects.toBe(failure);

            expect(logger.endPerformLog).toHaveBeenCalledTimes(1);
            expect(logger.endPerformLog).toHaveBeenCalledWith(start);
        });
    });
});

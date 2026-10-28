import "reflect-metadata";
import type { Mock } from "vitest";
import { DynamicMethod } from "./decorators/dynamic-method.decorator.js";
import { EnableSoftDelete } from "./decorators/enable-soft-delete.decorator.js";
import { QueryMethod } from "./decorators/query-method.decorator.js";
import { VSRepoError } from "./errors/VSRepoError.js";
import { VSLogLevel } from "./internal/enums/vs-log-level.enum.js";
import { VSRepoErrorType } from "./internal/enums/vsrepo-error-type.enum.js";
import { getSqlitePlaceholder } from "./internal/utils/placeholder-fns.util.js";
import { VSLogger } from "./internal/utils/vs-logger.util.js";
import { VSQueryBuilder } from "./internal/utils/vs-query-builder.util.js";
import { VSRawQueryBuilder } from "./internal/utils/vs-raw-query-builder.util.js";
import { VSSql } from "./internal/utils/vs-sql.util.js";
import { VSRepoOptions } from "./types/vsrepo/vsrepo-options.type.js";
import { VSRepoAdapter } from "./VSRepoAdapter.js";
import { VSRepository } from "./VSRepository.js";

interface User {
    id: string;
    name: string;
    age: number;
    score: number;
    deletedAt: Date | null;
}

type UserRepoOptions = Omit<VSRepoOptions<User, string>, "adapter"> & { adapter: VSRepoAdapter<User> };

class UserRepository extends VSRepository<User, string> {
    constructor(options: UserRepoOptions) {
        super({ logLevel: VSLogLevel.NONE, ...options });
    }

    callResolveDynamicMethods() {
        return this.resolveDynamicMethods();
    }
}

@EnableSoftDelete("deletedAt")
class SoftUserRepository extends UserRepository {}

@EnableSoftDelete()
class SoftNoFieldUserRepository extends UserRepository {}

class DynamicUserRepository extends UserRepository {
    @DynamicMethod()
    declare findByName: (name: string, options?: object) => Promise<User[]>;

    @QueryMethod("select * from user where age > ?1")
    declare findOlderThan: (age: number) => Promise<User[]>;
}

@EnableSoftDelete("deletedAt")
class SoftDynamicUserRepository extends DynamicUserRepository {}

class BrokenUserRepository extends UserRepository {
    @DynamicMethod()
    declare fetchByName: any;
}

const ADAPTER_METHODS = [
    "runInTransaction",
    "query",
    "findOne",
    "findOneOrThrow",
    "findMany",
    "save",
    "saveMany",
    "create",
    "createMany",
    "createManyReturning",
    "delete",
    "deleteMany",
    "deleteManyReturning",
    "update",
    "updateMany",
    "updateManyReturning",
    "count",
    "exists",
    "upsert",
    "incrementOne",
    "decrementOne",
    "multiplyOne",
    "divideOne",
    "incrementMany",
    "decrementMany",
    "multiplyMany",
    "divideMany",
    "sum",
    "average",
    "min",
    "max",
];

describe("VSRepository", () => {
    const W = { name: "Ana" };
    const DB = { db: "default-db" };

    let mocks: Record<string, Mock>;
    let adapter: VSRepoAdapter<User>;

    const make = (options: Partial<UserRepoOptions> = {}) => new UserRepository({ adapter, ...options });
    const makeSoft = (options: Partial<UserRepoOptions> = {}) => new SoftUserRepository({ adapter, ...options });

    async function catchAsyncError(fn: () => Promise<unknown>): Promise<any> {
        try {
            await fn();
        } catch (err) {
            return err;
        }

        throw new Error("Expected the function to reject");
    }

    function catchError(fn: () => unknown): any {
        try {
            fn();
        } catch (err) {
            return err;
        }

        throw new Error("Expected the function to throw");
    }

    beforeEach(() => {
        mocks = {
            getDbClient: vi.fn().mockReturnValue("default-db"),
            getPkName: vi.fn().mockReturnValue("id"),
            getPlaceholder: vi.fn(getSqlitePlaceholder),
        };

        for (const method of ADAPTER_METHODS) {
            mocks[method] = vi.fn();
        }

        mocks.runInTransaction!.mockImplementation(async (fn: (tx: unknown) => unknown) => fn("tx"));

        adapter = mocks as unknown as VSRepoAdapter<User>;
    });

    afterEach(() => {
        VSRepository.setGlobalConfig({});
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe("constructor", () => {
        it("should be defined", () => {
            expect(make()).toBeDefined();
        });

        describe("pkName", () => {
            it("should take the pkName from the adapter", async () => {
                await make().get("1");

                expect(mocks.findOne).toHaveBeenCalledWith({ id: "1" }, DB);
            });

            it("should prefer the pkName from the options over the adapter's", async () => {
                const repo = make({ pkName: "name" });

                await repo.get("Ana");

                expect(mocks.getPkName).not.toHaveBeenCalled();
                expect(mocks.findOne).toHaveBeenCalledWith({ name: "Ana" }, DB);
            });

            it("should throw a BASE error when no pkName can be determined", () => {
                delete mocks.getPkName;

                const error = catchError(() => make());

                expect(error).toBeInstanceOf(VSRepoError);
                expect(error.type).toBe(VSRepoErrorType.BASE);
                expect(error.message).toContain("did not implement the 'getPkName' method");
            });

            it("should not need the adapter's getPkName when pkName is configured", () => {
                delete mocks.getPkName;

                expect(() => make({ pkName: "id" })).not.toThrow();
            });
        });

        describe("soft delete", () => {
            it("should use the field from the decorator", async () => {
                await makeSoft().find(W);

                expect(mocks.findMany).toHaveBeenCalledWith({ name: "Ana", deletedAt: null }, expect.anything());
            });

            it("should use the global soft delete field when the decorator has none", async () => {
                VSRepository.setGlobalConfig({ softDeleteField: "removedAt" });

                await new SoftNoFieldUserRepository({ adapter }).find(W);

                expect(mocks.findMany).toHaveBeenCalledWith({ name: "Ana", removedAt: null }, expect.anything());
            });

            it("should prefer the decorator field over the global one", async () => {
                VSRepository.setGlobalConfig({ softDeleteField: "removedAt" });

                await makeSoft().find(W);

                expect(mocks.findMany).toHaveBeenCalledWith({ name: "Ana", deletedAt: null }, expect.anything());
            });

            it("should throw a BASE error when soft delete is enabled without any field", () => {
                const error = catchError(() => new SoftNoFieldUserRepository({ adapter }));

                expect(error).toBeInstanceOf(VSRepoError);
                expect(error.type).toBe(VSRepoErrorType.BASE);
                expect(error.message).toContain("A field for soft delete must be specified");
            });

            it("should not filter by any field when soft delete is not enabled", async () => {
                VSRepository.setGlobalConfig({ softDeleteField: "removedAt" });

                await make().find(W);

                expect(mocks.findMany).toHaveBeenCalledWith(W, expect.anything());
            });
        });

        describe("dynamic and query methods", () => {
            it("should resolve them eagerly by default", async () => {
                const repo = new DynamicUserRepository({ adapter });

                await repo.findByName("Ana");
                await repo.findOlderThan(18);

                expect(mocks.findMany).toHaveBeenCalledWith(W, DB);
                expect(mocks.query).toHaveBeenCalledWith("select * from user where age > ?", {
                    db: "default-db",
                    args: [18],
                    modifying: false,
                });
            });

            it("should apply the soft delete field and the default ordering to dynamic methods", async () => {
                const order = [{ age: "DESC" }] as any;
                const repo = new SoftDynamicUserRepository({ adapter, defaultOrdering: order });

                await repo.findByName("Ana");

                expect(mocks.findMany).toHaveBeenCalledWith(
                    { name: "Ana", deletedAt: null },
                    { db: "default-db", order },
                );
            });

            it("should postpone the resolution when lazyDynamicMethods is true", () => {
                const repo = new DynamicUserRepository({ adapter, lazyDynamicMethods: true });

                expect(repo.findByName).toBeUndefined();
                expect(repo.findOlderThan).toBeUndefined();
            });

            it("should resolve them on demand and report the counts", () => {
                const repo = new DynamicUserRepository({ adapter, lazyDynamicMethods: true });

                const result = repo.callResolveDynamicMethods();

                expect(result).toEqual({ dynamicMethodsCount: 1, queryMethodsCount: 1 });
                expect(repo.findByName).toBeTypeOf("function");
                expect(repo.findOlderThan).toBeTypeOf("function");
            });

            it("should take lazyDynamicMethods from the global config", () => {
                VSRepository.setGlobalConfig({ lazyDynamicMethods: true });

                const repo = new DynamicUserRepository({ adapter });

                expect(repo.findByName).toBeUndefined();
            });

            it("should prefer lazyDynamicMethods from the options over the global config", () => {
                VSRepository.setGlobalConfig({ lazyDynamicMethods: true });

                const repo = new DynamicUserRepository({ adapter, lazyDynamicMethods: false });

                expect(repo.findByName).toBeTypeOf("function");
            });

            it("should populate the internal cache with the resolved dynamic methods", () => {
                const repo = new DynamicUserRepository({ adapter });

                expect(repo._vsrepocache.has("findByName")).toBe(true);
            });

            it("should log and rethrow when the resolution fails", () => {
                const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

                const error = catchError(() => new BrokenUserRepository({ adapter, logLevel: VSLogLevel.ERROR }));

                expect(error).toBeInstanceOf(VSRepoError);
                expect(error.type).toBe(VSRepoErrorType.RESOLVER);
                expect(consoleError).toHaveBeenCalledWith(
                    expect.stringContaining("Failed to initialize BrokenUserRepository"),
                    expect.anything(),
                );
            });

            describe("resolving more than once", () => {
                it("should warn once when it was already resolved automatically", () => {
                    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
                    const repo = new DynamicUserRepository({ adapter, logLevel: VSLogLevel.WARN });

                    repo.callResolveDynamicMethods();
                    repo.callResolveDynamicMethods();

                    expect(consoleWarn).toHaveBeenCalledTimes(1);
                    expect(consoleWarn).toHaveBeenCalledWith(
                        expect.stringContaining("resolveDynamicMethods() was called more than once"),
                    );
                });

                it("should not warn on the first manual resolution of a lazy repository", () => {
                    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
                    const repo = new DynamicUserRepository({
                        adapter,
                        lazyDynamicMethods: true,
                        logLevel: VSLogLevel.WARN,
                    });

                    repo.callResolveDynamicMethods();

                    expect(consoleWarn).not.toHaveBeenCalled();
                });
            });
        });

        describe("vsPlaceholders", () => {
            it("should be enabled by default", async () => {
                await make().query("select * from user where id = ?1", { args: ["1"] });

                expect(mocks.query).toHaveBeenCalledWith("select * from user where id = ?", expect.anything());
            });

            it("should be disabled through the options", async () => {
                await make({ vsPlaceholders: false }).query("select * from user where id = $1", { args: ["1"] });

                expect(mocks.query).toHaveBeenCalledWith("select * from user where id = $1", expect.anything());
            });

            it("should be disabled through the global config", async () => {
                VSRepository.setGlobalConfig({ vsPlaceholders: false });

                await make().query("select * from user where id = $1", { args: ["1"] });

                expect(mocks.query).toHaveBeenCalledWith("select * from user where id = $1", expect.anything());
            });

            it("should prefer the options over the global config", async () => {
                VSRepository.setGlobalConfig({ vsPlaceholders: false });

                await make({ vsPlaceholders: true }).query("select * from user where id = ?1", { args: ["1"] });

                expect(mocks.query).toHaveBeenCalledWith("select * from user where id = ?", expect.anything());
            });

            it("should be forwarded to the query methods", async () => {
                class RawQueryRepository extends UserRepository {
                    @QueryMethod("select * from user where age > $1")
                    declare findOlderThan: (age: number) => Promise<User[]>;
                }

                await new RawQueryRepository({ adapter, vsPlaceholders: false }).findOlderThan(18);

                expect(mocks.query).toHaveBeenCalledWith("select * from user where age > $1", {
                    db: "default-db",
                    args: [18],
                    modifying: false,
                });
            });
        });

        describe("logging", () => {
            it("should use the WARN level by default and stay quiet on startup", () => {
                const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
                const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

                new UserRepository({ adapter, logLevel: undefined });

                expect(consoleLog).not.toHaveBeenCalled();
                expect(consoleWarn).not.toHaveBeenCalled();
            });

            it("should take the log level from the global config", () => {
                const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
                VSRepository.setGlobalConfig({ logLevel: VSLogLevel.INFO });

                new UserRepository({ adapter, logLevel: undefined });

                expect(consoleLog).toHaveBeenCalled();
            });

            it("should prefer the log level from the options over the global config", () => {
                const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
                VSRepository.setGlobalConfig({ logLevel: VSLogLevel.INFO });

                new UserRepository({ adapter, logLevel: VSLogLevel.NONE });

                expect(consoleLog).not.toHaveBeenCalled();
            });

            it("should log the initialization summary at INFO", () => {
                const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

                new SoftDynamicUserRepository({
                    adapter,
                    logLevel: VSLogLevel.INFO,
                    defaultOrdering: [{ age: "ASC" }] as any,
                });

                const lines = consoleLog.mock.calls.map(([line]) => String(line));

                expect(lines[0]).toContain("Initializing SoftDynamicUserRepository (pk: 'id'");
                expect(lines[0]).toContain("softDeleteField: 'deletedAt'");
                expect(lines[0]).toContain('defaultOrdering: [{"age":"ASC"}]');
                expect(lines[1]).toContain(
                    "SoftDynamicUserRepository ready (1 dynamic method(s), 1 query method(s) resolved)",
                );
            });

            it("should say the resolution was postponed when lazy", () => {
                const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

                new DynamicUserRepository({ adapter, logLevel: VSLogLevel.INFO, lazyDynamicMethods: true });

                const lines = consoleLog.mock.calls.map(([line]) => String(line));

                expect(lines.at(-1)).toContain("Resolution of dynamic methods postponed");
            });
        });
    });

    describe("base methods", () => {
        it.each<[string, (repo: UserRepository) => Promise<unknown>, string, any[]]>([
            ["find", r => r.find(W), "findMany", [W, DB]],
            ["find (no where)", r => r.find(), "findMany", [{}, DB]],
            ["findOne", r => r.findOne(W), "findOne", [W, DB]],
            ["findOne (no where)", r => r.findOne(), "findOne", [{}, DB]],
            ["findOneOrThrow", r => r.findOneOrThrow(W), "findOneOrThrow", [W, DB]],
            ["get", r => r.get("1"), "findOne", [{ id: "1" }, DB]],
            ["getOrThrow", r => r.getOrThrow("1"), "findOneOrThrow", [{ id: "1" }, DB]],
            ["save (single)", r => r.save({ name: "Ana" }), "save", [{ name: "Ana" }, DB]],
            ["save (array)", r => r.save([{ name: "Ana" }]), "saveMany", [[{ name: "Ana" }], DB]],
            ["create", r => r.create({ name: "Ana" }), "create", [{ name: "Ana" }, DB]],
            ["createMany", r => r.createMany([{ name: "Ana" }]), "createMany", [[{ name: "Ana" }], DB]],
            [
                "createManyReturning",
                r => r.createManyReturning([{ name: "Ana" }]),
                "createManyReturning",
                [[{ name: "Ana" }], DB],
            ],
            ["delete", r => r.delete(W), "delete", [W, DB]],
            ["remove", r => r.remove("1"), "delete", [{ id: "1" }, DB]],
            ["deleteMany", r => r.deleteMany(W), "deleteMany", [W, DB]],
            ["deleteManyReturning", r => r.deleteManyReturning(W), "deleteManyReturning", [W, DB]],
            ["upsert", r => r.upsert(W, { name: "Ana" }, { age: 1 }), "upsert", [W, { name: "Ana" }, { age: 1 }, DB]],
            ["update", r => r.update(W, { age: 1 }), "update", [W, { age: 1 }, DB]],
            ["patch", r => r.patch("1", { age: 1 }), "update", [{ id: "1" }, { age: 1 }, DB]],
            ["updateMany", r => r.updateMany(W, { age: 1 }), "updateMany", [W, { age: 1 }, DB]],
            [
                "updateManyReturning",
                r => r.updateManyReturning(W, { age: 1 }),
                "updateManyReturning",
                [W, { age: 1 }, DB],
            ],
            ["count", r => r.count(W), "count", [W, DB]],
            ["count (no where)", r => r.count(), "count", [{}, DB]],
            ["exists", r => r.exists(W), "exists", [W, DB]],
            ["has", r => r.has("1"), "exists", [{ id: "1" }, DB]],
            ["increment", r => r.increment("age", 1, W), "incrementOne", ["age", 1, W, DB]],
            ["decrement", r => r.decrement("age", 1, W), "decrementOne", ["age", 1, W, DB]],
            ["multiply", r => r.multiply("score", 2, W), "multiplyOne", ["score", 2, W, DB]],
            ["divide", r => r.divide("score", 2, W), "divideOne", ["score", 2, W, DB]],
            ["incrementMany", r => r.incrementMany("age", 1, W), "incrementMany", ["age", 1, W, DB]],
            ["decrementMany", r => r.decrementMany("age", 1, W), "decrementMany", ["age", 1, W, DB]],
            ["multiplyMany", r => r.multiplyMany("score", 2, W), "multiplyMany", ["score", 2, W, DB]],
            ["divideMany", r => r.divideMany("score", 2, W), "divideMany", ["score", 2, W, DB]],
            ["sum", r => r.sum("age", W), "sum", ["age", W, DB]],
            ["sum (no where)", r => r.sum("age"), "sum", ["age", {}, DB]],
            ["average", r => r.average("age", W), "average", ["age", W, DB]],
            ["average (no where)", r => r.average("age"), "average", ["age", {}, DB]],
            ["min", r => r.min("age", W), "min", ["age", W, DB]],
            ["min (no where)", r => r.min("age"), "min", ["age", {}, DB]],
            ["max", r => r.max("age", W), "max", ["age", W, DB]],
            ["max (no where)", r => r.max("age"), "max", ["age", {}, DB]],
        ])("%s should call the adapter and return its result", async (_name, run, adapterMethod, expectedArgs) => {
            const sentinel = { returned: true };
            mocks[adapterMethod]!.mockResolvedValue(sentinel);

            const result = await run(make());

            expect(mocks[adapterMethod]).toHaveBeenCalledTimes(1);
            expect(mocks[adapterMethod]).toHaveBeenCalledWith(...expectedArgs);
            expect(result).toBe(sentinel);
        });

        it("findAndCount should call the adapter and return its PaginatedResult", async () => {
            const sentinel1 = { returned: true };
            const sentinel2 = { returned: true };

            mocks.findMany!.mockResolvedValue(sentinel1);
            mocks.count!.mockResolvedValue(sentinel2);

            const result = await make().findAndCount(
                { id: "some" },
                { pagination: { limit: 2 }, order: { id: "DESC" } },
            );

            expect(mocks.findMany).toHaveBeenCalledTimes(1);
            expect(mocks.findMany).toHaveBeenCalledWith(
                { id: "some" },
                { pagination: { limit: 2 }, order: { id: "DESC" }, db: DB.db },
            );
            expect(mocks.count).toHaveBeenCalledTimes(1);
            expect(mocks.count).toHaveBeenCalledWith({ id: "some" }, DB);
            expect(result.result).toBe(sentinel1);
            expect(result.count).toBe(sentinel2);
        });

        describe("merge", () => {
            const stored: User = { id: "1", name: "Ana", age: 20, score: 0, deletedAt: null };

            beforeEach(() => {
                mocks.findOne!.mockResolvedValue({ ...stored });
            });

            it("should fetch the record with findOne and return it merged with the given object", async () => {
                const result = await make().merge(W, { age: 30 });

                expect(mocks.findOne).toHaveBeenCalledTimes(1);
                expect(mocks.findOne).toHaveBeenCalledWith(W, DB);
                expect(result).toEqual({ ...stored, age: 30 });
            });

            it("should not persist anything", async () => {
                await make().merge(W, { age: 30 });

                for (const method of ["save", "saveMany", "create", "update", "updateMany", "upsert"]) {
                    expect(mocks[method]).not.toHaveBeenCalled();
                }
            });

            it("should return null when the record does not exist", async () => {
                mocks.findOne!.mockResolvedValue(null);

                const result = await make().merge(W, { age: 30 });

                expect(result).toBeNull();
            });

            it("should use the db provided in the options", async () => {
                await make().merge(W, { age: 30 }, { db: "tx" });

                expect(mocks.findOne).toHaveBeenCalledWith(W, { db: "tx" });
            });

            describe("mergeConfig", () => {
                it("should use the one given in the repository options", async () => {
                    const repo = make({ mergeConfig: { nullBehavior: "ignore" } });

                    const result = await repo.merge(W, { name: null as any, age: 30 });

                    expect(result).toEqual({ ...stored, age: 30 });
                });

                it("should prefer the one given in the method options", async () => {
                    const repo = make({ mergeConfig: { nullBehavior: "ignore" } });

                    const result = await repo.merge(
                        W,
                        { name: null as any },
                        { mergeConfig: { nullBehavior: "keep" } },
                    );

                    expect(result).toEqual({ ...stored, name: null });
                });

                it("should overwrite null values when there is no config at all", async () => {
                    const result = await make().merge(W, { deletedAt: null, name: null as any });

                    expect(result).toEqual({ ...stored, name: null });
                });

                it("should ignore undefined values by default", async () => {
                    const result = await make().merge(W, { name: undefined });

                    expect(result).toEqual(stored);
                });

                it("should keep undefined values when configured", async () => {
                    const result = await make({ mergeConfig: { undefinedBehavior: "keep" } }).merge(W, {
                        age: undefined,
                    } as Partial<User>);

                    expect(result?.age).toBeUndefined();
                });
            });
        });

        describe("options", () => {
            it("should use the db provided in the options", async () => {
                await make().find(W, { db: "tx" });

                expect(mocks.findMany).toHaveBeenCalledWith(W, { db: "tx" });
                expect(mocks.getDbClient).not.toHaveBeenCalled();
            });

            it("should forward select and relations to the adapter", async () => {
                const select = { id: true };
                const relations = { posts: true };

                await make().find(W, { select, relations } as any);

                expect(mocks.findMany).toHaveBeenCalledWith(W, { db: "default-db", select, relations });
            });

            it("should forward the options of the simple methods to the adapter", async () => {
                const select = { id: true };

                await make().update(W, { age: 1 }, { select, db: "tx" } as any);

                expect(mocks.update).toHaveBeenCalledWith(W, { age: 1 }, { db: "tx", select });
            });

            it("should forward ignoreConflicts on the createMany methods", async () => {
                await make().createMany([{ name: "Ana" }], { ignoreConflicts: true } as any);

                expect(mocks.createMany).toHaveBeenCalledWith([{ name: "Ana" }], {
                    db: "default-db",
                    ignoreConflicts: true,
                });
            });

            it("should not mutate the options object provided by the caller", async () => {
                const options = { see: "all" as const };

                await make().find(W, options);

                expect(options).toEqual({ see: "all" });
                expect(options).not.toHaveProperty("db");
            });

            it("should not mutate a frozen options object", async () => {
                const options = Object.freeze({ see: "all" as const });

                await expect(make().find(W, options)).resolves.not.toThrow();
            });

            it("should not leak the db of one call into another when the options object is reused", async () => {
                const repo = make();
                const options = { see: "all" as const };

                await repo.find(W, options);
                mocks.getDbClient!.mockReturnValue("another-db");
                await repo.find(W, options);

                expect(mocks.findMany).toHaveBeenNthCalledWith(1, W, expect.objectContaining({ db: "default-db" }));
                expect(mocks.findMany).toHaveBeenNthCalledWith(2, W, expect.objectContaining({ db: "another-db" }));
            });

            it("should keep the db provided by the caller without changing the options object", async () => {
                const options = { db: "tx" };

                await make().count(W, options);

                expect(mocks.count).toHaveBeenCalledWith(W, { db: "tx" });
                expect(options).toEqual({ db: "tx" });
            });

            it("should use the db client of the adapter on every call", async () => {
                const repo = make();

                await repo.find(W);
                mocks.getDbClient!.mockReturnValue("another-db");
                await repo.find(W);

                expect(mocks.findMany).toHaveBeenNthCalledWith(1, W, { db: "default-db" });
                expect(mocks.findMany).toHaveBeenNthCalledWith(2, W, { db: "another-db" });
            });
        });

        describe("default ordering", () => {
            const defaultOrdering = [{ name: "ASC" }] as any;

            it.each([
                ["find", "findMany", (r: UserRepository, o?: object) => r.find(W, o)],
                ["findOne", "findOne", (r: UserRepository, o?: object) => r.findOne(W, o)],
                ["findOneOrThrow", "findOneOrThrow", (r: UserRepository, o?: object) => r.findOneOrThrow(W, o)],
                ["get", "findOne", (r: UserRepository, o?: object) => r.get(W.name, o)],
                ["getOrThrow", "findOneOrThrow", (r: UserRepository, o?: object) => r.getOrThrow(W.name, o)],
                ["merge", "findOne", (r: UserRepository, o?: object) => r.merge(W, { age: 1 }, o)],
            ])("%s should apply it", async (_name, adapterMethod, run) => {
                await run(make({ defaultOrdering }));

                expect(mocks[adapterMethod]).toHaveBeenCalledWith(expect.any(Object), {
                    db: "default-db",
                    order: defaultOrdering,
                });
            });

            it("should prefer the order provided in the options", async () => {
                const order = [{ age: "DESC" }] as any;

                await make({ defaultOrdering }).find(W, { order });

                expect(mocks.findMany).toHaveBeenCalledWith(W, { db: "default-db", order });
            });

            it("should not apply it to the other methods", async () => {
                const repo = make({ defaultOrdering });

                await repo.count(W);

                expect(mocks.count).toHaveBeenCalledWith(W, DB);
            });

            it("should not send any order when there is no default ordering", async () => {
                await make().find(W);

                expect(mocks.findMany).toHaveBeenCalledWith(W, DB);
                expect(vi.mocked(mocks.findMany!).mock.calls[0]![1].order).toBeUndefined();
            });
        });

        describe("see mode", () => {
            it.each<[string, (r: SoftUserRepository, o?: object) => Promise<unknown>, string, any]>([
                ["find", (r, o) => r.find(W, o), "findMany", W],
                ["findOne", (r, o) => r.findOne(W, o), "findOne", W],
                ["get", (r, o) => r.get("1", o), "findOne", { id: "1" }],
                ["merge", (r, o) => r.merge(W, { age: 1 }, o), "findOne", W],
                ["delete", (r, o) => r.delete(W, o), "delete", W],
                ["update", (r, o) => r.update(W, { age: 1 }, o), "update", W],
                ["count", (r, o) => r.count(W, o), "count", W],
                ["exists", (r, o) => r.exists(W, o), "exists", W],
                ["has", (r, o) => r.has("1", o), "exists", { id: "1" }],
            ])("%s should only see the active records by default", async (_name, run, adapterMethod, where) => {
                await run(makeSoft());

                expect(vi.mocked(mocks[adapterMethod]!).mock.calls[0]![0]).toEqual({ ...where, deletedAt: null });
            });

            it("should see only the removed records", async () => {
                await makeSoft().find(W, { see: "removed" });

                expect(mocks.findMany).toHaveBeenCalledWith(
                    { name: "Ana", deletedAt: { not: null } },
                    expect.anything(),
                );
            });

            it("should see every record", async () => {
                await makeSoft().find(W, { see: "all" });

                expect(mocks.findMany).toHaveBeenCalledWith(W, expect.anything());
            });

            it("should pass the see mode on to the adapter options untouched", async () => {
                await makeSoft().find(W, { see: "all" });

                expect(vi.mocked(mocks.findMany!).mock.calls[0]![1].see).toBe("all");
            });
        });

        describe("perform logs", () => {
            it("should log the start and the end of the execution", async () => {
                const token = { operation: "run find", start: 0 };
                const start = vi.spyOn(VSLogger.prototype, "startPerformLog").mockReturnValue(token);
                const end = vi.spyOn(VSLogger.prototype, "endPerformLog").mockImplementation(() => {});

                await make().find(W);

                expect(start).toHaveBeenCalledWith("run find");
                expect(end).toHaveBeenCalledWith(token);
            });

            it("should end the perform log and rethrow when the adapter fails", async () => {
                const token = { operation: "run count", start: 0 };
                const failure = new Error("db down");
                const repo = make();
                vi.spyOn(VSLogger.prototype, "startPerformLog").mockReturnValue(token);
                const end = vi.spyOn(VSLogger.prototype, "endPerformLog").mockImplementation(() => {});
                mocks.count!.mockRejectedValue(failure);

                await expect(repo.count(W)).rejects.toBe(failure);

                expect(end).toHaveBeenCalledTimes(1);
                expect(end).toHaveBeenCalledWith(token);
            });
        });
    });

    describe("soft delete methods", () => {
        const deletePayload = { deletedAt: expect.any(Date) };
        const restorePayload = { deletedAt: null };

        it.each<[string, (r: SoftUserRepository) => Promise<unknown>, string, any[]]>([
            ["softDelete", r => r.softDelete(W), "update", [W, deletePayload, DB]],
            ["softRemove", r => r.softRemove("1"), "update", [{ id: "1" }, deletePayload, DB]],
            ["softDeleteMany", r => r.softDeleteMany(W), "updateMany", [W, deletePayload, DB]],
            ["restore", r => r.restore(W), "update", [W, restorePayload, DB]],
            ["recover", r => r.recover("1"), "update", [{ id: "1" }, restorePayload, DB]],
            ["restoreMany", r => r.restoreMany(W), "updateMany", [W, restorePayload, DB]],
        ])("%s should update the soft delete field and see every record", async (_name, run, method, args) => {
            const sentinel = { returned: true };
            mocks[method]!.mockResolvedValue(sentinel);

            const result = await run(makeSoft());

            expect(mocks[method]).toHaveBeenCalledWith(...args);
            expect(result).toBe(sentinel);
        });

        it("should set the soft delete field to the current date", async () => {
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(new Date("2026-01-02T03:04:05.000Z"));

            await makeSoft().softDelete(W);

            expect(mocks.update).toHaveBeenCalledWith(W, { deletedAt: new Date("2026-01-02T03:04:05.000Z") }, DB);
        });

        it("should honor a custom see mode", async () => {
            await makeSoft().softDelete(W, { see: "active" });

            expect(mocks.update).toHaveBeenCalledWith(
                { name: "Ana", deletedAt: null },
                deletePayload,
                expect.anything(),
            );
        });

        it("should honor a custom see mode when restoring", async () => {
            await makeSoft().restore(W, { see: "removed" });

            expect(mocks.update).toHaveBeenCalledWith(
                { name: "Ana", deletedAt: { not: null } },
                restorePayload,
                expect.anything(),
            );
        });

        it("should use the field configured globally", async () => {
            VSRepository.setGlobalConfig({ softDeleteField: "removedAt" });

            await new SoftNoFieldUserRepository({ adapter }).restore(W);

            expect(mocks.update).toHaveBeenCalledWith(W, { removedAt: null }, DB);
        });

        describe("without soft delete enabled", () => {
            it.each<[string, (r: UserRepository) => Promise<unknown>]>([
                ["softDelete", r => r.softDelete(W)],
                ["softRemove", r => r.softRemove("1")],
                ["softDeleteMany", r => r.softDeleteMany(W)],
                ["restore", r => r.restore(W)],
                ["recover", r => r.recover("1")],
                ["restoreMany", r => r.restoreMany(W)],
            ])("%s should reject with a BASE error", async (_name, run) => {
                const error = await catchAsyncError(() => run(make()));

                expect(error).toBeInstanceOf(VSRepoError);
                expect(error.type).toBe(VSRepoErrorType.BASE);
                expect(error.message).toContain("can only be used if you have enabled soft delete");
                expect(mocks.update).not.toHaveBeenCalled();
                expect(mocks.updateMany).not.toHaveBeenCalled();
            });

            it("should log the failure as an error", async () => {
                const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

                await catchAsyncError(() => make({ logLevel: VSLogLevel.ERROR }).softDelete(W));

                expect(consoleError).toHaveBeenCalledWith(
                    expect.stringContaining(
                        "UserRepository: this method can only be used if you have enabled soft delete",
                    ),
                );
            });
        });
    });

    describe("transaction", () => {
        it("should run the function through the adapter and return its result", async () => {
            const fn = vi.fn().mockResolvedValue("done");

            const result = await make().transaction(fn);

            expect(mocks.runInTransaction).toHaveBeenCalledWith(fn, undefined);
            expect(fn).toHaveBeenCalledWith("tx");
            expect(result).toBe("done");
        });

        it("should forward the transaction options", async () => {
            const fn = vi.fn();
            const options = { isolationLevel: "SERIALIZABLE" } as any;

            await make().transaction(fn, options);

            expect(mocks.runInTransaction).toHaveBeenCalledWith(fn, options);
        });

        it("should rethrow what the function throws", async () => {
            const failure = new Error("rollback");

            await expect(
                make().transaction(async () => {
                    throw failure;
                }),
            ).rejects.toBe(failure);
        });

        it.each([undefined, null, "fn", 1, {}])("should reject with a BASE error when fn is %j", async fn => {
            const error = await catchAsyncError(() => make().transaction(fn as any));

            expect(error).toBeInstanceOf(VSRepoError);
            expect(error.type).toBe(VSRepoErrorType.BASE);
            expect(error.message).toContain("'fn' must be a valid function");
            expect(mocks.runInTransaction).not.toHaveBeenCalled();
        });
    });

    describe("getDbClient and getAdapter", () => {
        it("should return the db client of the adapter", () => {
            expect(make().getDbClient()).toBe("default-db");
        });

        it("should return the adapter", () => {
            expect(make().getAdapter()).toBe(adapter);
        });
    });

    describe("query", () => {
        beforeEach(() => {
            mocks.query!.mockResolvedValue([]);
        });

        it("should compile the vs placeholders using the adapter", async () => {
            await make().query("select * from user where id = ?1 and age > ?2", { args: ["1", 18] });

            expect(mocks.getPlaceholder).toHaveBeenCalled();
            expect(mocks.query).toHaveBeenCalledWith("select * from user where id = ? and age > ?", {
                args: ["1", 18],
                db: "default-db",
                modifying: false,
            });
        });

        it("should use the placeholder format of the adapter", async () => {
            mocks.getPlaceholder!.mockImplementation((index: number) => `$${index + 1}`);

            await make().query("select * from user where id = ?1", { args: ["1"] });

            expect(mocks.query).toHaveBeenCalledWith("select * from user where id = $1", expect.anything());
        });

        it("should work with no args and no options", async () => {
            await make().query("select 1");

            expect(mocks.query).toHaveBeenCalledWith("select 1", { args: [], db: "default-db", modifying: false });
        });

        it("should pass the db and the modifying flag on", async () => {
            await make().query("delete from user", { db: "tx", modifying: true } as any);

            expect(mocks.query).toHaveBeenCalledWith("delete from user", { args: [], db: "tx", modifying: true });
        });

        it("should compile a VSSql fragment", async () => {
            await make().query(VSSql.sql`select * from user where id = ${"1"} and age > ${18}`);

            expect(mocks.query).toHaveBeenCalledWith("select * from user where id = ? and age > ?", {
                args: ["1", 18],
                db: "default-db",
                modifying: false,
            });
        });

        it("should compile a VSSql fragment even when vsPlaceholders is disabled", async () => {
            await make({ vsPlaceholders: false }).query(VSSql.sql`select * from user where id = ${"1"}`);

            expect(mocks.query).toHaveBeenCalledWith("select * from user where id = ?", {
                args: ["1"],
                db: "default-db",
                modifying: false,
            });
        });

        it("should send the string and the args untouched when vsPlaceholders is disabled", async () => {
            await make({ vsPlaceholders: false }).query("select * from user where id = $1", { args: ["1"] });

            expect(mocks.getPlaceholder).not.toHaveBeenCalled();
            expect(mocks.query).toHaveBeenCalledWith("select * from user where id = $1", {
                args: ["1"],
                db: "default-db",
                modifying: false,
            });
        });

        it("should reject with a BASE error for an invalid query when vsPlaceholders is disabled", async () => {
            const error = await catchAsyncError(() => make({ vsPlaceholders: false }).query(123 as any));

            expect(error).toBeInstanceOf(VSRepoError);
            expect(error.type).toBe(VSRepoErrorType.BASE);
            expect(error.message).toContain("'query' must be a valid string or a 'VSSql' fragment");
            expect(mocks.query).not.toHaveBeenCalled();
        });

        it("should return the adapter result as-is by default", async () => {
            const rows = [{ id: "1" }, { id: "2" }];
            mocks.query!.mockResolvedValue(rows);

            await expect(make().query("select * from user")).resolves.toBe(rows);
        });

        it("should collapse the result to the first row on singleResult", async () => {
            mocks.query!.mockResolvedValue([{ id: "1" }, { id: "2" }]);

            await expect(make().query("select * from user", { singleResult: true })).resolves.toEqual({ id: "1" });
        });

        it("should resolve to null on singleResult when there are no rows", async () => {
            mocks.query!.mockResolvedValue([]);

            await expect(make().query("select * from user", { singleResult: true })).resolves.toBeNull();
        });

        it("should not collapse a non-array result on singleResult", async () => {
            mocks.query!.mockResolvedValue(3);

            await expect(
                make().query("update user set age = 1", { singleResult: true, modifying: true } as any),
            ).resolves.toBe(3);
        });

        it("should not forward singleResult to the adapter", async () => {
            await make().query("select 1", { singleResult: true });

            expect(vi.mocked(mocks.query!).mock.calls[0]![1]).not.toHaveProperty("singleResult");
        });

        it("should log the resolved query in debug", async () => {
            const logDebug = vi.spyOn(VSLogger.prototype, "logDebug").mockImplementation(() => {});

            await make().query("select * from user where id = ?1", { args: ["1"], singleResult: true });

            expect(logDebug).toHaveBeenCalledWith("UserRepository query:", {
                query: "select * from user where id = ?",
                args: ["1"],
                modifying: false,
                singleResult: true,
            });
        });

        it("should log the start and the end of the execution", async () => {
            const token = { operation: "run query", start: 0 };
            const start = vi.spyOn(VSLogger.prototype, "startPerformLog").mockReturnValue(token);
            const end = vi.spyOn(VSLogger.prototype, "endPerformLog").mockImplementation(() => {});

            await make().query("select 1");

            expect(start).toHaveBeenCalledWith("run query");
            expect(end).toHaveBeenCalledWith(token);
        });

        it("should end the perform log and rethrow when the adapter fails", async () => {
            const token = { operation: "run query", start: 0 };
            const failure = new Error("syntax error");
            const repo = make();
            vi.spyOn(VSLogger.prototype, "startPerformLog").mockReturnValue(token);
            const end = vi.spyOn(VSLogger.prototype, "endPerformLog").mockImplementation(() => {});
            mocks.query!.mockRejectedValue(failure);

            await expect(repo.query("select 1")).rejects.toBe(failure);

            expect(end).toHaveBeenCalledTimes(1);
            expect(end).toHaveBeenCalledWith(token);
        });
    });

    describe("query builders", () => {
        beforeEach(() => {
            mocks.findMany!.mockResolvedValue([]);
            mocks.query!.mockResolvedValue([]);
        });

        it("should create a query builder", () => {
            expect(make().createQueryBuilder()).toBeInstanceOf(VSQueryBuilder);
        });

        it("should create a raw query builder", () => {
            expect(make().createRawQueryBuilder()).toBeInstanceOf(VSRawQueryBuilder);
        });

        it("should make the query builder use the adapter db client by default", async () => {
            await make().createQueryBuilder().getResult();

            expect(mocks.findMany).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(DB));
        });

        it("should make the query builder use the provided db", async () => {
            await make()
                .createQueryBuilder("tx" as any)
                .getResult();

            expect(mocks.findMany).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ db: "tx" }));
        });

        it("should make the query builder respect the soft delete of the repository", async () => {
            await makeSoft().createQueryBuilder().getResult();

            expect(mocks.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ deletedAt: null }),
                expect.anything(),
            );
        });

        it("should make the raw query builder use the adapter db client by default", async () => {
            await make().createRawQueryBuilder().select("1").from("user").execute();

            expect(mocks.query).toHaveBeenCalledWith("select 1 from user", expect.objectContaining(DB));
        });

        it("should make the raw query builder use the provided db", async () => {
            await make()
                .createRawQueryBuilder("tx" as any)
                .select("1")
                .from("user")
                .execute();

            expect(mocks.query).toHaveBeenCalledWith("select 1 from user", expect.objectContaining({ db: "tx" }));
        });

        it("should expose the query builder through the static getQueryBuilder", () => {
            const repo = make();
            const spy = vi.spyOn(repo, "createQueryBuilder");

            const qb = VSRepository.getQueryBuilder(repo, "tx" as any);

            expect(qb).toBeInstanceOf(VSQueryBuilder);
            expect(spy).toHaveBeenCalledWith("tx");
        });

        it("should expose the raw query builder through the static getRawQueryBuilder", () => {
            const repo = make();
            const spy = vi.spyOn(repo, "createRawQueryBuilder");

            const qb = VSRepository.getRawQueryBuilder(repo, "tx" as any);

            expect(qb).toBeInstanceOf(VSRawQueryBuilder);
            expect(spy).toHaveBeenCalledWith("tx");
        });
    });
});

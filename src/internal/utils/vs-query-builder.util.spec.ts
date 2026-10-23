import { VSRepoAdapterError } from "../../errors/VSRepoAdapterError.js";
import { VSRepoError } from "../../errors/VSRepoError.js";
import { DeepPartial } from "../../types/utils/deep-partial.type.js";
import { Ordering } from "../../types/utils/ordering.type.js";
import { SeeMode } from "../../types/utils/see-mode.type.js";
import { VSRepoRelations } from "../../types/vsrepo/vsrepo-relations.type.js";
import { VSRepoSelect } from "../../types/vsrepo/vsrepo-select.type.js";
import { VSRepoWhere } from "../../types/vsrepo/vsrepo-where.type.js";
import { VSRepoAdapter } from "../../VSRepoAdapter.js";
import { AdapterErrorCode } from "../enums/adapter-error-code.enum.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
import { MergeWheresResolver } from "../resolvers/merge-wheres.resolver.js";
import { getVsPlaceholder } from "./placeholder-fns.util.js";
import { VSLogger } from "./vs-logger.util.js";
import { VSQueryBuilder } from "./vs-query-builder.util.js";

type User = { id: string; name: string; age: number; deletedAt: Date | null; address: { city: string; state: string } };

describe("VSRawQueryBuilder", () => {
    const db = { db: 100 };
    let adapter: VSRepoAdapter<User>;
    let logger: VSLogger;
    let qb: VSQueryBuilder<User>;
    let mergeWheresResolver: MergeWheresResolver<User>;

    beforeEach(() => {
        adapter = {
            getPlaceholder: vi.fn(getVsPlaceholder),
            query: vi.fn(),
            findMany: vi.fn(),
            findOne: vi.fn(),
            findOneOrThrow: vi.fn(),
            count: vi.fn(),
            exists: vi.fn(),
        } as any;
        logger = { logDebug: vi.fn(), startPerformLog: vi.fn(), endPerformLog: vi.fn() } as any;
        mergeWheresResolver = { resolve: vi.fn() };
        qb = new VSQueryBuilder<User>(db, adapter, mergeWheresResolver, logger);
    });

    it("should be defined", () => {
        expect(qb).toBeDefined();
    });

    describe("select", () => {
        it("should call the adapter with the provided select", async () => {
            const select: VSRepoSelect<User> = { id: true, name: true };
            const returned = [{ id: "123", name: "joao" }] as any;

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);

            const result = await qb.select(select).getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(undefined, expect.objectContaining({ select }));
            expect(result).toBe(returned);
        });

        it("should call with no select", async () => {
            const returned = [{ id: "123", name: "joao" }] as any;

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);

            const result = await qb.getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(
                undefined,
                expect.not.objectContaining({ select: expect.anything() }),
            );
            expect(result).toBe(returned);
        });
    });

    describe("relations", () => {
        it("should call the adapter with the provided relations", async () => {
            const relations: VSRepoRelations<User> = { address: true };
            const returned = [{ id: "123", name: "joao", address: { city: "tal", state: "tal" } }] as any;

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);

            const result = await qb.relations(relations).getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(undefined, expect.objectContaining({ relations }));
            expect(result).toBe(returned);
        });

        it("should call with no relations", async () => {
            const returned = [{ id: "123", name: "joao" }] as any;

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);

            const result = await qb.getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(
                undefined,
                expect.not.objectContaining({ relations: expect.anything() }),
            );
            expect(result).toBe(returned);
        });
    });

    describe("where", () => {
        it("should call the adapter with the provided where", async () => {
            const where: VSRepoWhere<User> = { name: "joao" };
            const returned = [{ id: "123", name: "joao", age: 99 }] as any;

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);
            vi.spyOn(mergeWheresResolver, "resolve").mockImplementation((_, val) => val ?? {});

            const result = await qb.where(where).getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(where, expect.objectContaining({}));
            expect(mergeWheresResolver.resolve).toHaveBeenCalledWith("active", where);
            expect(result).toBe(returned);
        });

        it("should call with no where", async () => {
            const returned = [{ id: "123", name: "joao", age: 99 }] as any;

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);
            vi.spyOn(mergeWheresResolver, "resolve").mockImplementation((_, val) => val ?? {});

            const result = await qb.getResult();

            expect(adapter.findMany).toHaveBeenCalledWith({}, expect.objectContaining({}));
            expect(mergeWheresResolver.resolve).toHaveBeenCalledWith("active", undefined);
            expect(result).toBe(returned);
        });
    });

    describe("orderBy", () => {
        it("should call the adapter with the provided orderBy", async () => {
            const orderBy: Ordering<User> = { name: "ASC" };
            const returned = [{ id: "123", name: "joao", address: { city: "tal", state: "tal" } }] as any;

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);

            const result = await qb.orderBy(orderBy).getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(undefined, expect.objectContaining({ order: orderBy }));
            expect(result).toBe(returned);
        });

        it("should call with no orderBy", async () => {
            const returned = [{ id: "123", name: "joao" }] as any;

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);

            const result = await qb.getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(
                undefined,
                expect.not.objectContaining({ order: expect.anything() }),
            );
            expect(result).toBe(returned);
        });
    });

    describe("limit", () => {
        it("should call the adapter with the provided limit", async () => {
            const limit = 10;
            const returned = [{ id: "123", name: "joao", address: { city: "tal", state: "tal" } }] as any;

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);

            const result = await qb.limit(limit).getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(
                undefined,
                expect.objectContaining({ pagination: { limit } }),
            );
            expect(result).toBe(returned);
        });

        it("should call with no limit", async () => {
            const returned = [{ id: "123", name: "joao" }] as any;

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);

            const result = await qb.getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(
                undefined,
                expect.not.objectContaining({ pagination: expect.anything() }),
            );
            expect(result).toBe(returned);
        });

        it("should throw if the value is negative", async () => {
            let thrown: any;

            try {
                qb.limit(-1);
                throw new Error("never");
            } catch (err) {
                thrown = err;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });

        it("should throw if the value is not integer", async () => {
            let thrown: any;

            try {
                qb.limit(1.5);
                throw new Error("never");
            } catch (err) {
                thrown = err;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });
    });

    describe("offset", () => {
        it("should call the adapter with the provided offset", async () => {
            const offset = 10;
            const returned = [{ id: "123", name: "joao", address: { city: "tal", state: "tal" } }] as any;

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);

            const result = await qb.offset(offset).getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(
                undefined,
                expect.objectContaining({ pagination: { offset } }),
            );
            expect(result).toBe(returned);
        });

        it("should call with no offset", async () => {
            const returned = [{ id: "123", name: "joao" }] as any;

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);

            const result = await qb.getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(
                undefined,
                expect.not.objectContaining({ pagination: expect.anything() }),
            );
            expect(result).toBe(returned);
        });

        it("should throw if the value is negative", async () => {
            let thrown: any;

            try {
                qb.offset(-1);
                throw new Error("never");
            } catch (err) {
                thrown = err;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });

        it("should throw if the value is not integer", async () => {
            let thrown: any;

            try {
                qb.offset(1.5);
                throw new Error("never");
            } catch (err) {
                thrown = err;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });
    });

    describe("see", () => {
        it("should call the adapter with the provided see restriction", async () => {
            const see: SeeMode = "all";
            const returned = [{ id: "123", name: "joao", address: { city: "tal", state: "tal" } }] as any;
            const filter: VSRepoWhere<User> = { age: 18 };

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);
            vi.spyOn(mergeWheresResolver, "resolve").mockReturnValue(filter);

            const result = await qb.where(filter).see(see).getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(filter, expect.objectContaining({}));
            expect(mergeWheresResolver.resolve).toHaveBeenCalledWith("all", filter);
            expect(result).toBe(returned);
        });

        it("should use 'active by default'", async () => {
            const returned = [{ id: "123", name: "joao", address: { city: "tal", state: "tal" } }] as any;
            const filter: VSRepoWhere<User> = { age: 18 };
            const filterWithSoftDelete = { ...filter, deletedAt: null };

            vi.spyOn(adapter, "findMany").mockResolvedValue(returned);
            vi.spyOn(mergeWheresResolver, "resolve").mockReturnValue(filterWithSoftDelete);

            const result = await qb.where(filter).getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(filterWithSoftDelete, expect.objectContaining({}));
            expect(mergeWheresResolver.resolve).toHaveBeenCalledWith("active", filter);
            expect(result).toBe(returned);
        });
    });

    describe("setDb", () => {
        it("should replace the instance's db", () => {
            const db2 = { db: 234 };

            vi.spyOn(logger, "logDebug").mockReturnValue(undefined);

            qb.setDb(db2);

            expect(logger.logDebug).toHaveBeenCalledWith(expect.stringContaining("db replaced"), undefined);
            expect((qb as any).db).toBe(db2);
        });

        it("should call the adapter with the provided db", async () => {
            const db2 = { db: 234 };

            vi.spyOn(logger, "logDebug").mockReturnValue(undefined);
            vi.spyOn(adapter, "findMany").mockResolvedValue([]);

            await qb.setDb(db2).getResult();

            expect(logger.logDebug).toHaveBeenCalledWith(expect.stringContaining("db replaced"), undefined);
            expect((qb as any).db).toBe(db2);

            expect(adapter.findMany).toHaveBeenCalledWith(undefined, { db: db2 });
        });

        it("should return the adapter's instance", () => {
            const db2 = { db: 234 };

            const result = qb.setDb(db2);

            expect(result).toBe(qb);
        });
    });

    describe("clone", () => {
        it("should return a clone of the qb", () => {
            vi.spyOn(logger, "logDebug").mockReturnValue(undefined);

            const qb2 = qb
                .select({ id: true, name: true, age: true })
                .limit(10)
                .offset(2)
                .where({ deletedAt: null })
                .clone();

            expect(logger.logDebug).toHaveBeenCalledWith(expect.stringContaining("clone"), undefined);
            expect(qb2).not.toBe(qb);
            expect({ ...qb }).toEqual({ ...qb2 });
        });

        it("a change in a clone should not change the original instance", () => {
            const qb2 = qb
                .select({ id: true, name: true, age: true })
                .limit(10)
                .offset(2)
                .where({ deletedAt: null })
                .clone();
            qb2.limit(40);

            const qb3 = qb2.clone().select({ id: true });

            expect(qb2).not.toBe(qb);
            expect(qb2).not.toBe(qb3);
            expect({ ...qb }).not.toEqual({ ...qb2 });
            expect({ ...qb2 }).not.toEqual({ ...qb3 });
        });
    });

    describe("getResult/getOneResult/getOneResultOrThrow/getCount/getExistence/getResultAndCount", () => {
        const mockWhere: VSRepoWhere<User> = { age: { gt: 18 } };
        const mockSelect: VSRepoSelect<User> = { id: true, name: true };
        const mockRelations = { address: true };
        const mockOrder: Ordering<User> = { name: "ASC" };
        const mockLimit = 10;
        const mockOffset = 10;

        beforeEach(() => {
            vi.spyOn(mergeWheresResolver, "resolve").mockImplementation((_, val) => val ?? {});

            qb.select(mockSelect)
                .relations(mockRelations)
                .where(mockWhere)
                .see("all")
                .orderBy(mockOrder)
                .limit(mockLimit)
                .offset(mockOffset);

            vi.spyOn(logger, "startPerformLog").mockReturnValue({} as any);
            vi.spyOn(logger, "endPerformLog").mockReturnValue(undefined);
        });

        afterEach(() => {
            expect(logger.startPerformLog).toHaveBeenCalledWith(expect.stringContaining("run query builder "));
            expect(logger.endPerformLog).toHaveBeenCalledWith({});
        });

        it("getResult should correct call the adapter", async () => {
            vi.spyOn(adapter, "findMany").mockResolvedValue([]);

            const result = await qb.getResult();

            expect(adapter.findMany).toHaveBeenCalledWith(mockWhere, {
                db,
                pagination: { limit: mockLimit, offset: mockOffset },
                order: mockOrder,
                select: mockSelect,
                relations: mockRelations,
            });
            expect(result).toEqual([]);
        });

        it("getOneResult should correct call the adapter", async () => {
            vi.spyOn(adapter, "findOne").mockResolvedValue({ id: "uuid", name: "some guy" } as any);

            const result = await qb.getOneResult();

            expect(adapter.findOne).toHaveBeenCalledWith(mockWhere, {
                db,
                pagination: { limit: mockLimit, offset: mockOffset },
                order: mockOrder,
                select: mockSelect,
                relations: mockRelations,
            });
            expect(result).toEqual({ id: "uuid", name: "some guy" });
        });

        it("getOneResultOrThrow should correct call the adapter", async () => {
            vi.spyOn(adapter, "findOneOrThrow").mockResolvedValue({ id: "uuid", name: "some guy" } as any);

            const result = await qb.getOneResultOrThrow();

            expect(adapter.findOneOrThrow).toHaveBeenCalledWith(mockWhere, {
                db,
                pagination: { limit: mockLimit, offset: mockOffset },
                order: mockOrder,
                select: mockSelect,
                relations: mockRelations,
            });
            expect(result).toEqual({ id: "uuid", name: "some guy" });
        });

        it("getCount should correct call the adapter", async () => {
            vi.spyOn(adapter, "count").mockResolvedValue(2);

            const result = await qb.getCount();

            expect(adapter.count).toHaveBeenCalledWith(mockWhere, {
                db,
                pagination: { limit: mockLimit, offset: mockOffset },
            });
            expect(result).toEqual(2);
        });

        it("getExistence should correct call the adapter", async () => {
            vi.spyOn(adapter, "exists").mockResolvedValue(true);

            const result = await qb.getExistence();

            expect(adapter.exists).toHaveBeenCalledWith(mockWhere, { db });
            expect(result).toEqual(true);
        });

        it("getResultAndCount should correct call the adapter", async () => {
            vi.spyOn(adapter, "findMany").mockResolvedValue([]);
            vi.spyOn(adapter, "count").mockResolvedValue(0);

            const result = await qb.getResultAndCount();

            expect(adapter.findMany).toHaveBeenCalledWith(mockWhere, {
                db,
                pagination: { limit: mockLimit, offset: mockOffset },
                order: mockOrder,
                select: mockSelect,
                relations: mockRelations,
            });
            expect(adapter.count).toHaveBeenCalledWith(mockWhere, {
                db,
            });
            expect(result).toEqual({ result: [], count: 0 });
        });

        it("execute should propragate an thrown error", async () => {
            vi.spyOn(adapter, "findMany").mockRejectedValue(
                new VSRepoAdapterError("some error", AdapterErrorCode.UNKNOWN, null),
            );

            await expect(qb.getResult()).rejects.toThrow(VSRepoAdapterError);

            expect(adapter.findMany).toHaveBeenCalledWith(mockWhere, {
                db,
                pagination: { limit: mockLimit, offset: mockOffset },
                order: mockOrder,
                select: mockSelect,
                relations: mockRelations,
            });
        });
    });
});

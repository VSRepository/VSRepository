import { DynamicMethod } from "../../decorators/dynamic-method.decorator.js";
import { VSRepoError } from "../../errors/VSRepoError.js";
import { VSRepoAdapter } from "../../VSRepoAdapter.js";
import { VSRepository } from "../../VSRepository.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
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
        adapter = { getDbClient: vi.fn(), findOne: vi.fn(), findMany: vi.fn() } as any;
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

        function methodTest(method: string, expectedCall: object, ...args: any[]) {
            class Repository {
                _vsrepocache = new Map();

                @DynamicMethod()
                [method]: any;
            }

            const repo = new Repository() as unknown as VSRepository<any, any> & {
                [p: string]: (...args: any[]) => Promise<any>;
            };

            resolver.resolve(repo);

            repo[method]!(...args);

            expect(mergeWheresResolver.resolve).toHaveBeenCalledWith(undefined, expectedCall);
        }

        it("should resolve the method", () => {
            const mockName = "some name";
            methodTest("findByNameAndAge", { name: mockName, age: 2 }, mockName, 2);
        });
    });
});
